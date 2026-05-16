import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import * as Sentry from "@sentry/nextjs";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { getStripe, planFromPriceId, statusGrantsProAccess } from "@/lib/stripe";

// Stripe sends events as raw JSON; signature verification requires the
// untouched body bytes. We use req.text() (not req.json()) and let Stripe's
// SDK do the parsing after verification. Force the Node runtime so we can
// rely on Buffer / crypto.
export const runtime = "nodejs";

const HANDLED_EVENTS = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
  "invoice.payment_succeeded",
]);

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    Sentry.captureMessage("Stripe webhook called but STRIPE_WEBHOOK_SECRET is unset");
    return new Response("Stripe webhook secret not configured", { status: 500 });
  }

  const headerPayload = await headers();
  const signature = headerPayload.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    Sentry.captureException(err);
    console.error("[stripe-webhook] signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    // 200 + acknowledge so Stripe doesn't keep retrying. We log so we can
    // notice if a meaningful event type starts arriving that we're ignoring.
    console.log(`[stripe-webhook] ignoring event type ${event.type}`);
    return NextResponse.json({ received: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.payment_failed":
      case "invoice.payment_succeeded": {
        // Payment events flow through the linked subscription. We let the
        // sub.updated event that Stripe sends alongside drive the actual
        // tier flip; here we just record so dunning email work in Package 4
        // can pick up the signal later.
        await handleInvoiceEvent(event.data.object as Stripe.Invoice, event.type);
        break;
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    console.error(`[stripe-webhook] handler failed for ${event.type}`, err);
    // Return 500 so Stripe retries. Webhook handlers MUST be idempotent.
    return new Response("Handler error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Two pieces we care about: the customer ID (so we can find them again)
  // and the subscription ID (so we can pull its full state). The client
  // reference id is the Clerk userId we set when creating the checkout.
  const userId = session.client_reference_id;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id;

  if (!userId) {
    Sentry.captureMessage("Stripe checkout.session.completed missing client_reference_id");
    return;
  }
  if (!customerId) {
    Sentry.captureMessage(`Stripe checkout.session.completed missing customer for user ${userId}`);
    return;
  }

  // Persist customer ID immediately so the Customer Portal endpoint can find
  // the user even before the sub.updated event lands.
  await db
    .update(users)
    .set({ stripeCustomerId: customerId, updatedAt: new Date() })
    .where(eq(users.id, userId));

  // Pull the full subscription state and apply it. This is redundant with
  // the customer.subscription.created event Stripe will also send, but the
  // ordering between them isn't guaranteed, and applying twice is safe.
  if (subscriptionId) {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await applySubscriptionToUser(userId, subscription);
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  // Look up the local user by stripe_customer_id. The checkout handler should
  // have populated it; if not, we fall back to the subscription metadata.
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;

  let userId: string | null = null;

  const [byCustomer] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  if (byCustomer) {
    userId = byCustomer.id;
  } else if (subscription.metadata?.userId) {
    userId = subscription.metadata.userId;
    // Backfill the customer id on the user row.
    await db
      .update(users)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  if (!userId) {
    Sentry.captureMessage(
      `Stripe subscription event for customer ${customerId} with no matching user`,
    );
    return;
  }

  await applySubscriptionToUser(userId, subscription);
}

async function applySubscriptionToUser(userId: string, subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const plan = planFromPriceId(priceId);
  const grantsPro = statusGrantsProAccess(subscription.status);

  // We only ever flip free <-> pro from webhook signals. Comped users are
  // managed manually via scripts/grant-comped-pro.ts and must not be
  // downgraded by a stale Stripe event (in case they happen to also have
  // a personal subscription for testing).
  const [existing] = await db
    .select({ subscriptionTier: users.subscriptionTier })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const nextTier = (() => {
    if (!existing) return grantsPro ? "pro" : "free";
    if (existing.subscriptionTier === "pro_comped") return "pro_comped";
    return grantsPro ? "pro" : "free";
  })();

  await db
    .update(users)
    .set({
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: toDate(getCurrentPeriodEnd(subscription)),
      trialEnd: toDate(subscription.trial_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      subscriptionTier: nextTier,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  console.log(
    `[stripe-webhook] applied subscription ${subscription.id} for user ${userId}: status=${subscription.status} plan=${plan?.key ?? "unknown"} tier=${nextTier}`,
  );
}

async function handleInvoiceEvent(invoice: Stripe.Invoice, eventType: Stripe.Event.Type) {
  // Hook for Package 4 (dunning emails). For now just structured logging
  // so we have an audit trail. The accompanying subscription.updated event
  // is what actually flips the tier.
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  console.log(
    `[stripe-webhook] invoice event ${eventType} customer=${customerId} status=${invoice.status} amount=${invoice.amount_due}`,
  );
}

function toDate(unixSeconds: number | null | undefined): Date | null {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000);
}

// Stripe API versions from 2025-09 onward (e.g. 2026-04-22.dahlia) removed
// current_period_end from the Subscription object and moved it onto each
// SubscriptionItem. Webhook payloads use the account's configured API
// version, which can be newer than the SDK we pin, so we check both
// locations and take whichever is populated.
function getCurrentPeriodEnd(subscription: Stripe.Subscription): number | null {
  if (subscription.current_period_end) return subscription.current_period_end;
  const item = subscription.items.data[0] as
    | (Stripe.SubscriptionItem & { current_period_end?: number })
    | undefined;
  return item?.current_period_end ?? null;
}
