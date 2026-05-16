import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { db, users } from "@/db";

// Lazily create the users row for the current Clerk user if the
// `user.created` webhook hasn't landed yet. Safe to call on hot paths:
// the fast path is a single indexed SELECT on the primary key, and the
// slow path (insert) only runs once per user.
export async function ensureUserRow(userId: string): Promise<void> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (existing) return;

  const clerkUser = await currentUser().catch((err) => {
    Sentry.captureException(err);
    return null;
  });
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ??
    clerkUser?.emailAddresses?.[0]?.emailAddress ??
    "unknown@example.com";

  await db
    .insert(users)
    .values({ id: userId, email })
    .onConflictDoNothing({ target: users.id });
}
