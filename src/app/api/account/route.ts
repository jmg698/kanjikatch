import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import { db, users } from "@/db";

// Permanently deletes the authenticated user.
//
// Order of operations:
//   1. Delete from Clerk — this is the authoritative auth record; if the
//      Clerk user is gone, any lingering DB row is harmless.
//   2. Defensively delete the local users row. The Clerk user.deleted webhook
//      handler at /api/webhooks/clerk does the same thing, but we don't want
//      a transient webhook delay to leave the account half-deleted from the
//      user's perspective. The webhook is idempotent (delete-where-id).
//   3. Every user-owned table FKs to users.id with ON DELETE CASCADE, so the
//      local delete cascades to source images, kanji, vocab, sentences,
//      review sessions/history/tracks, user stats, generated sentences (and
//      their targets), content items, and user reports. api_usage_events
//      uses ON DELETE SET NULL so cost-tracking history survives in
//      anonymized form — documented in the Privacy Policy.
export async function DELETE() {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const clerk = await clerkClient();
    await clerk.users.deleteUser(userId);
  } catch (err) {
    Sentry.captureException(err, { extra: { stage: "clerk_delete", userId } });
    return NextResponse.json(
      { error: "Failed to delete account. Please try again or contact support." },
      { status: 500 },
    );
  }

  try {
    await db.delete(users).where(eq(users.id, userId));
  } catch (err) {
    // The Clerk user is already gone at this point, so the user is effectively
    // signed out and can no longer authenticate. The webhook will retry the
    // cascade delete. Log but don't surface — the user's intent has been
    // honored.
    Sentry.captureException(err, { extra: { stage: "db_cascade", userId } });
  }

  return NextResponse.json({ ok: true });
}
