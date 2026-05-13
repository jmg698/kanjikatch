/**
 * Grant comped Pro tier to a user. Reads/writes against the users table
 * directly — no admin UI by design (see PRO_TIER_PLAN.md "Implementation
 * notes" section).
 *
 * Usage:
 *   npx tsx scripts/grant-comped-pro.ts <user-id-or-email> [reason]
 *   npx tsx scripts/grant-comped-pro.ts --revoke <user-id-or-email>
 *
 * Examples:
 *   # Grant yourself comped Pro by Clerk user id
 *   npx tsx scripts/grant-comped-pro.ts user_2abc123 "founder dogfood"
 *
 *   # Or by email (looks up the matching users row)
 *   npx tsx scripts/grant-comped-pro.ts founder@kanjikatch.app "founder dogfood"
 *
 *   # Revoke (drops back to free)
 *   npx tsx scripts/grant-comped-pro.ts --revoke user_2abc123
 *
 * Notes:
 *   - This script is idempotent — re-running is safe and refreshes the
 *     comped_reason / comped_at fields.
 *   - The granter identity (comped_by) is read from the `COMPED_GRANTER`
 *     env var, falling back to `cli`. Set COMPED_GRANTER when scripting.
 *   - Comped users are NEVER counted in any conversion/revenue metric and
 *     never see payment UI. Don't mention this tier in user-facing copy.
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set in .env");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

function printUsage(): void {
  console.error("Usage: npx tsx scripts/grant-comped-pro.ts <user-id-or-email> [reason]");
  console.error("       npx tsx scripts/grant-comped-pro.ts --revoke <user-id-or-email>");
}

interface UserRow {
  id: string;
  email: string;
  subscription_tier: string;
}

async function resolveUser(identifier: string): Promise<UserRow | null> {
  // Try by id first (Clerk IDs are prefixed like `user_...`), then by email.
  const byId = (await sql`
    SELECT id, email, subscription_tier
    FROM users
    WHERE id = ${identifier}
    LIMIT 1
  `) as UserRow[];
  if (byId.length > 0) return byId[0];

  const byEmail = (await sql`
    SELECT id, email, subscription_tier
    FROM users
    WHERE email = ${identifier}
    LIMIT 1
  `) as UserRow[];
  return byEmail[0] ?? null;
}

async function grant(identifier: string, reason: string): Promise<void> {
  const user = await resolveUser(identifier);
  if (!user) {
    console.error(`No user found for "${identifier}".`);
    console.error("If the account is brand new, sign in once so the Clerk webhook can create the users row, then retry.");
    process.exit(1);
  }

  const granter = process.env.COMPED_GRANTER ?? "cli";

  await sql`
    UPDATE users
    SET subscription_tier = 'pro_comped',
        comped_by = ${granter},
        comped_reason = ${reason},
        comped_at = now(),
        updated_at = now()
    WHERE id = ${user.id}
  `;

  console.log(`Granted pro_comped to ${user.email} (${user.id}).`);
  console.log(`  comped_by:     ${granter}`);
  console.log(`  comped_reason: ${reason}`);
  console.log(`  previous tier: ${user.subscription_tier}`);
}

async function revoke(identifier: string): Promise<void> {
  const user = await resolveUser(identifier);
  if (!user) {
    console.error(`No user found for "${identifier}".`);
    process.exit(1);
  }

  if (user.subscription_tier !== "pro_comped") {
    console.warn(`User ${user.email} is currently "${user.subscription_tier}", not "pro_comped". Revoking anyway → free.`);
  }

  await sql`
    UPDATE users
    SET subscription_tier = 'free',
        comped_by = NULL,
        comped_reason = NULL,
        comped_at = NULL,
        updated_at = now()
    WHERE id = ${user.id}
  `;

  console.log(`Revoked comped Pro from ${user.email} (${user.id}). Now: free.`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  if (args[0] === "--revoke") {
    if (!args[1]) {
      printUsage();
      process.exit(1);
    }
    await revoke(args[1]);
    return;
  }

  const identifier = args[0];
  const reason = args.slice(1).join(" ") || "founder dogfood";
  await grant(identifier, reason);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
