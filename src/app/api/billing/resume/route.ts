import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [userRow] = await db
      .select({
        stripeSubscriptionId: users.stripeSubscriptionId,
        cancelAtPeriodEnd: users.cancelAtPeriodEnd,
        subscriptionTier: users.subscriptionTier,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRow?.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "No active subscription to resume." },
        { status: 404 },
      );
    }

    if (userRow.subscriptionTier === "pro_comped") {
      return NextResponse.json(
        { error: "Comped accounts don't have a Stripe subscription." },
        { status: 409 },
      );
    }

    if (!userRow.cancelAtPeriodEnd) {
      // Already active and renewing — return 200 so a duplicate click is a no-op
      // rather than an error the UI has to special-case.
      return NextResponse.json({ resumed: false, alreadyActive: true });
    }

    const stripe = getStripe();
    await stripe.subscriptions.update(userRow.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    // The customer.subscription.updated webhook will clear cancel_at_period_end
    // in our DB. We don't update locally here to keep Stripe as the source of
    // truth and avoid drift if the webhook payload differs.
    return NextResponse.json({ resumed: true });
  } catch (err) {
    Sentry.captureException(err);
    console.error("[billing/resume] failed", err);
    return NextResponse.json(
      { error: "Failed to resume subscription. Please try again." },
      { status: 500 },
    );
  }
}
