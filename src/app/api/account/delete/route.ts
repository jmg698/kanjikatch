import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

// User-initiated account deletion. The flow is:
//   1. Verify the request — caller must confirm by typing their own email.
//   2. Cancel any active Stripe subscription (immediate, no proration —
//      the user is leaving, not pausing).
//   3. Delete the user in Clerk. Clerk will fire a user.deleted webhook,
//      which our existing handler uses to delete the users row; FK cascade
//      then wipes every related table.
//   4. As a safety net (in case the webhook is delayed), we also delete the
//      users row here directly. The webhook will then be a no-op.
//
// We intentionally do NOT delete the Stripe customer record — Stripe wants
// it kept for tax / invoice history. The customer becomes orphaned in
// Stripe, which is standard practice.

const bodySchema = z.object({
  confirmEmail: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Type your email exactly to confirm." },
        { status: 400 },
      );
    }

    const [userRow] = await db
      .select({
        email: users.email,
        stripeSubscriptionId: users.stripeSubscriptionId,
        subscriptionStatus: users.subscriptionStatus,
        subscriptionTier: users.subscriptionTier,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRow) {
      // Already gone — treat as success rather than 404; the user just
      // wants to be sure their data is deleted.
      return NextResponse.json({ ok: true, alreadyDeleted: true });
    }

    // Email check is a defense-in-depth confirmation, not an auth check.
    // The auth check is the Clerk session above.
    if (parsed.data.confirmEmail.trim().toLowerCase() !== userRow.email.trim().toLowerCase()) {
      return NextResponse.json(
        { error: "Email confirmation did not match." },
        { status: 400 },
      );
    }

    // Step 1: cancel Stripe subscription if active. We don't refund — the
    // user can email support@kanjikatch.com if they believe a refund is
    // owed; that's a manual call per ToS §5.
    if (
      userRow.stripeSubscriptionId &&
      userRow.subscriptionTier !== "pro_comped" &&
      userRow.subscriptionStatus &&
      !["canceled", "incomplete_expired"].includes(userRow.subscriptionStatus)
    ) {
      try {
        const stripe = getStripe();
        await stripe.subscriptions.cancel(userRow.stripeSubscriptionId, {
          // Pro-rated invoice items not created — we're walking away.
          invoice_now: false,
          prorate: false,
        });
      } catch (err) {
        // A cancel failure shouldn't block the deletion. Worst case the
        // sub continues to bill against an orphan Stripe customer — log
        // loudly and continue. We can clean these up out-of-band.
        Sentry.captureException(err, { tags: { stage: "stripe-cancel-on-delete" } });
        console.error("[account/delete] stripe cancel failed", err);
      }
    }

    // Step 2: delete the DB row first. FK cascade wipes related tables.
    // Doing this before the Clerk delete ensures local cleanup even if
    // Clerk is slow or down.
    await db.delete(users).where(eq(users.id, userId));

    // Step 3: delete the Clerk user. This invalidates the session, so the
    // browser will be bounced to /sign-in on the next request.
    try {
      const clerk = await clerkClient();
      await clerk.users.deleteUser(userId);
    } catch (err) {
      // DB is already gone, so the user's data is deleted regardless.
      // Surface the Clerk error so we notice if it's persistently failing.
      Sentry.captureException(err, { tags: { stage: "clerk-delete" } });
      console.error("[account/delete] clerk delete failed", err);
      return NextResponse.json(
        { ok: true, warning: "Account data deleted, but auth provider cleanup failed. Email support if you can still sign in." },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    console.error("[account/delete] failed", err);
    return NextResponse.json(
      { error: "Failed to delete account. Please email support." },
      { status: 500 },
    );
  }
}
