/**
 * Migrate all of one user's data onto another user account.
 *
 * Built for the Clerk dev -> prod cutover: signing in with the same email in
 * the production Clerk instance creates a NEW Clerk user id, so the library
 * that was captured under the old (development) user id needs to be
 * re-pointed onto the new (production) user id. All data tables key off
 * users.id (the Clerk user id), so this is a straight re-association.
 *
 * IMPORTANT: this only works when both users live in the SAME database
 * (i.e. dev and prod share one DATABASE_URL). Always run the dry-run first.
 * If it reports 0 rows for the --from user, that user's data lives in a
 * different database and you'll need to export/import across databases
 * instead of running this script.
 *
 * Usage:
 *   # 1. Dry run (DEFAULT — changes nothing, just reports what would move):
 *   npx tsx scripts/migrate-user-data.ts --from <oldUserId> --to <newUserId>
 *
 *   # 2. Execute for real (ONLY after taking a Neon backup/branch):
 *   npx tsx scripts/migrate-user-data.ts --from <oldUserId> --to <newUserId> --execute
 *
 * Where to get the ids (Clerk Dashboard -> Users -> your account -> "User ID"):
 *   --from = DEVELOPMENT instance user id  (user_...)  the account with your library
 *   --to   = PRODUCTION  instance user id  (user_...)  the new empty account
 *
 * Run it against the PRODUCTION database — set DATABASE_URL in .env to the
 * database your live site uses before running.
 *
 * What --execute does, atomically in a single transaction:
 *   1. Deletes the destination user's existing rows in each data table
 *      (clears the empty onboarding state so nothing collides on unique keys).
 *   2. Re-points every data row from the source user to the destination user.
 *   3. Marks the destination user's onboarding tour as completed so the
 *      /dashboard gate stops redirecting to /welcome.
 *   4. Deletes the now-empty source user row.
 *
 * It does NOT touch billing fields on the destination user — set up real
 * production billing separately (and re-grant comped Pro with
 * scripts/grant-comped-pro.ts if you had it in dev).
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

// Every table whose rows belong to a user via a `user_id` column. Order is not
// significant for the re-point UPDATEs (ids are preserved); the per-table
// DELETEs of the destination's rows are safe in any order because the only
// inter-table FKs among these are ON DELETE SET NULL / CASCADE.
// (generated_sentence_targets has no user_id — it cascades from
// generated_sentences automatically.)
const DATA_TABLES = [
  "source_images",
  "kanji",
  "vocabulary",
  "sentences",
  "review_sessions",
  "review_history",
  "user_stats",
  "generated_sentences",
  "review_tracks",
  "content_items",
  "user_reports",
  "api_usage_events",
] as const;

interface UserRow {
  id: string;
  email: string;
}

function parseArgs(argv: string[]): { from?: string; to?: string; execute: boolean } {
  let from: string | undefined;
  let to: string | undefined;
  let execute = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--from") from = argv[++i];
    else if (argv[i] === "--to") to = argv[++i];
    else if (argv[i] === "--execute") execute = true;
  }
  return { from, to, execute };
}

function printUsage(): void {
  console.error("Usage: npx tsx scripts/migrate-user-data.ts --from <oldUserId> --to <newUserId> [--execute]");
  console.error("Run without --execute first to preview (dry run).");
}

async function findUser(id: string): Promise<UserRow | null> {
  const rows = (await sql`SELECT id, email FROM users WHERE id = ${id} LIMIT 1`) as UserRow[];
  return rows[0] ?? null;
}

async function countFor(userId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of DATA_TABLES) {
    // table names come from the hardcoded DATA_TABLES constant, never user input.
    const rows = (await sql.query(`SELECT count(*)::int AS n FROM ${table} WHERE user_id = $1`, [userId])) as { n: number }[];
    counts[table] = rows[0]?.n ?? 0;
  }
  return counts;
}

function printCounts(label: string, counts: Record<string, number>): void {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`\n${label} (${total} rows total):`);
  for (const table of DATA_TABLES) {
    if (counts[table] > 0) console.log(`  ${table.padEnd(22)} ${counts[table]}`);
  }
  if (total === 0) console.log("  (no rows)");
}

async function main(): Promise<void> {
  const { from, to, execute } = parseArgs(process.argv.slice(2));

  if (!from || !to) {
    printUsage();
    process.exit(1);
  }
  if (from === to) {
    console.error("--from and --to are the same id; nothing to do.");
    process.exit(1);
  }

  const fromUser = await findUser(from);
  const toUser = await findUser(to);

  if (!fromUser) {
    console.error(`\nSource user "${from}" was not found in THIS database.`);
    console.error("Either the id is wrong, or the old library lives in a different");
    console.error("database than the one DATABASE_URL points at (separate dev/prod DBs).");
    console.error("In that case this script can't help — you'll need a cross-database export/import.");
    process.exit(1);
  }
  if (!toUser) {
    console.error(`\nDestination user "${to}" was not found in THIS database.`);
    console.error("Sign in to the production app once (so the Clerk webhook / ensureUserRow");
    console.error("creates the users row), then re-run with the correct production user id.");
    process.exit(1);
  }

  console.log(`Migrating data in database: ${DATABASE_URL!.replace(/:\/\/[^@]*@/, "://****@")}`);
  console.log(`  FROM  ${fromUser.id}  (${fromUser.email})`);
  console.log(`  TO    ${toUser.id}  (${toUser.email})`);

  const fromCounts = await countFor(from);
  const toCounts = await countFor(to);
  printCounts("Will MOVE from source", fromCounts);
  printCounts("Will first CLEAR on destination", toCounts);

  const fromTotal = Object.values(fromCounts).reduce((a, b) => a + b, 0);
  if (fromTotal === 0) {
    console.log("\nSource user has no data in this database — nothing to migrate.");
    console.log("If you expected a library here, your old data is probably in a different database.");
    process.exit(0);
  }

  if (!execute) {
    console.log("\nDRY RUN — no changes made. Re-run with --execute to apply (take a Neon backup first).");
    process.exit(0);
  }

  // --- Apply, atomically. Both users still exist throughout phases 1-2, so the
  // user_id FK is always satisfied; the source user row is removed last. ---
  await sql.transaction([
    // Phase 1: clear the destination's (onboarding-only) rows so re-pointed
    // rows can't collide on unique indexes like (user_id, character).
    sql`DELETE FROM review_history       WHERE user_id = ${to}`,
    sql`DELETE FROM generated_sentences  WHERE user_id = ${to}`,
    sql`DELETE FROM review_sessions      WHERE user_id = ${to}`,
    sql`DELETE FROM review_tracks        WHERE user_id = ${to}`,
    sql`DELETE FROM sentences            WHERE user_id = ${to}`,
    sql`DELETE FROM user_reports         WHERE user_id = ${to}`,
    sql`DELETE FROM kanji                WHERE user_id = ${to}`,
    sql`DELETE FROM vocabulary           WHERE user_id = ${to}`,
    sql`DELETE FROM content_items        WHERE user_id = ${to}`,
    sql`DELETE FROM source_images        WHERE user_id = ${to}`,
    sql`DELETE FROM user_stats           WHERE user_id = ${to}`,
    sql`DELETE FROM api_usage_events     WHERE user_id = ${to}`,

    // Phase 2: re-point every source row onto the destination user.
    sql`UPDATE source_images       SET user_id = ${to} WHERE user_id = ${from}`,
    sql`UPDATE kanji               SET user_id = ${to} WHERE user_id = ${from}`,
    sql`UPDATE vocabulary          SET user_id = ${to} WHERE user_id = ${from}`,
    sql`UPDATE sentences           SET user_id = ${to} WHERE user_id = ${from}`,
    sql`UPDATE review_sessions     SET user_id = ${to} WHERE user_id = ${from}`,
    sql`UPDATE review_history      SET user_id = ${to} WHERE user_id = ${from}`,
    sql`UPDATE user_stats          SET user_id = ${to} WHERE user_id = ${from}`,
    sql`UPDATE generated_sentences SET user_id = ${to} WHERE user_id = ${from}`,
    sql`UPDATE review_tracks       SET user_id = ${to} WHERE user_id = ${from}`,
    sql`UPDATE content_items       SET user_id = ${to} WHERE user_id = ${from}`,
    sql`UPDATE user_reports        SET user_id = ${to} WHERE user_id = ${from}`,
    sql`UPDATE api_usage_events    SET user_id = ${to} WHERE user_id = ${from}`,

    // Phase 3: destination keeps its library; skip onboarding; drop old row.
    sql`UPDATE users SET onboarding_tour_status = 'completed', updated_at = now() WHERE id = ${to}`,
    sql`DELETE FROM users WHERE id = ${from}`,
  ]);

  const afterCounts = await countFor(to);
  printCounts("Destination now owns", afterCounts);
  console.log(`\nDone. Deleted source user row ${from}. Reload /dashboard to see the migrated library.`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
