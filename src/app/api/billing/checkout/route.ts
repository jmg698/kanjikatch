import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { ensureUserRow } from "@/lib/ensure-user";
import { getAppUrl, getPlan, getStripe, type PlanKey } from "@/lib/stripe";

export const runtime = "nodejs";

const bodySchema = z.object({
  plan: z.enum(["pro_monthly", "pro_annual", "pro_founder_monthly", "pro_founder_annual"]),
  // Optional path to return to after a successful or canceled checkout.
  // The /pricing page passes /dashboard; the post-extract upgrade CTA
  // passes /capture so the user lands back where they hit the wall.
  returnTo: z.string().optional(),
});

const TRIAL_DAYS = 7;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const planKey = parsed.data.plan as PlanKey;
    const plan = getPlan(planKey);
    if (!plan) {
      return NextResponse.json(
        { error: "This plan is not currently available." },
        { status: 400 },
      );
    }

    // Self-heal in case the Clerk user.created webhook hasn't landed yet so
    // a brand-new signup can upgrade immediately (e.g. straight from
    // onboarding) without bouncing on a "still provisioning" error.
    await ensureUserRow(userId);

    const [userRow] = await db
      .select({
        email: users.email,
        stripeCustomerId: users.stripeCustomerId,
        subscriptionTier: users.subscriptionTier,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRow) {
      // ensureUserRow above should have made this unreachable. If we still
      // got nothing, something's wrong with the DB write — surface a real
      // error rather than charging ahead and creating a Stripe customer
      // with no row to attach it to.
      return NextResponse.json(
        { error: "Failed to provision account. Please try again." },
        { status: 500 },
      );
    }

    if (userRow.subscriptionTier === "pro_comped") {
      // Comped users shouldn't see checkout in the first place, but block
      // here as a safety net so we never run them through Stripe.
      return NextResponse.json(
        { error: "Your account already has Pro access." },
        { status: 409 },
      );
    }

    const stripe = getStripe();
    const appUrl = getAppUrl();
    const returnPath = sanitizeReturnPath(parsed.data.returnTo) ?? "/dashboard/billing";

    // Reuse the existing Stripe customer when present so a returning user
    // with a canceled subscription doesn't accumulate duplicate customers.
    // Fall back to creating a new one tied to their Clerk email.
    let customerId = userRow.stripeCustomerId;
    if (!customerId) {
      const clerkUser = await currentUser();
      const email = clerkUser?.primaryEmailAddress?.emailAddress ?? userRow.email;
      const customer = await stripe.customers.create({
        email,
        metadata: { userId },
      });
      customerId = customer.id;
      await db
        .update(users)
        .set({ stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(users.id, userId));
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: plan.priceId, quantity: 1 }],
      // 7-day trial with a card on file — matches PRO_TIER_PLAN.md.
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: { userId, plan: plan.key },
      },
      client_reference_id: userId,
      allow_promotion_codes: true,
      success_url: `${appUrl}${returnPath}?billing=success`,
      cancel_url: `${appUrl}${returnPath}?billing=canceled`,
      metadata: { userId, plan: plan.key },
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL");
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    Sentry.captureException(err);
    console.error("[billing/checkout] failed", err);
    return NextResponse.json(
      { error: "Failed to start checkout. Please try again." },
      { status: 500 },
    );
  }
}

// Only allow same-app returns. An attacker who can pass arbitrary returnTo
// values can phish the user through the Stripe success URL.
function sanitizeReturnPath(input: string | undefined): string | null {
  if (!input) return null;
  if (!input.startsWith("/")) return null;
  if (input.startsWith("//")) return null;
  return input;
}
