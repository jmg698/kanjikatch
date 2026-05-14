import Stripe from "stripe";

// Lazy singleton — initializing eagerly at import time would crash the
// process if STRIPE_SECRET_KEY is unset at boot. Most pages don't need
// Stripe, so we defer the throw until first use.

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to your environment to use billing features.",
    );
  }

  // Pin the API version so server-side schema changes in Stripe can't
  // silently break us. Bump deliberately when upgrading the SDK.
  _stripe = new Stripe(key, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
    appInfo: {
      name: "kanjikatch",
    },
  });

  return _stripe;
}

// Plan catalog. Maps the four Stripe price IDs we expose to a normalized
// shape used by the pricing page and checkout endpoint. When a plan key
// is referenced but the corresponding env var isn't set, the entry is
// dropped — the pricing UI hides the toggle and the checkout endpoint
// returns 400. This lets us deploy the code before all four Stripe prices
// are configured (e.g. founder tier might launch later).

export type PlanKey =
  | "pro_monthly"
  | "pro_annual"
  | "pro_founder_monthly"
  | "pro_founder_annual";

export interface PlanDefinition {
  key: PlanKey;
  priceId: string;
  amountUsd: number;
  interval: "month" | "year";
  tier: "pro";
  // founder = grandfathered price, locked while subscription is active.
  variant: "standard" | "founder";
}

const PLAN_DEFAULTS: Record<PlanKey, Omit<PlanDefinition, "priceId">> = {
  pro_monthly: { key: "pro_monthly", amountUsd: 10, interval: "month", tier: "pro", variant: "standard" },
  pro_annual: { key: "pro_annual", amountUsd: 100, interval: "year", tier: "pro", variant: "standard" },
  pro_founder_monthly: { key: "pro_founder_monthly", amountUsd: 7, interval: "month", tier: "pro", variant: "founder" },
  pro_founder_annual: { key: "pro_founder_annual", amountUsd: 70, interval: "year", tier: "pro", variant: "founder" },
};

const PRICE_ID_ENV_KEYS: Record<PlanKey, string> = {
  pro_monthly: "STRIPE_PRICE_ID_PRO_MONTHLY",
  pro_annual: "STRIPE_PRICE_ID_PRO_ANNUAL",
  pro_founder_monthly: "STRIPE_PRICE_ID_PRO_FOUNDER_MONTHLY",
  pro_founder_annual: "STRIPE_PRICE_ID_PRO_FOUNDER_ANNUAL",
};

export function getPlanCatalog(): Record<PlanKey, PlanDefinition | null> {
  const out: Record<PlanKey, PlanDefinition | null> = {
    pro_monthly: null,
    pro_annual: null,
    pro_founder_monthly: null,
    pro_founder_annual: null,
  };
  for (const key of Object.keys(PRICE_ID_ENV_KEYS) as PlanKey[]) {
    const priceId = process.env[PRICE_ID_ENV_KEYS[key]];
    if (priceId) {
      out[key] = { ...PLAN_DEFAULTS[key], priceId };
    }
  }
  return out;
}

export function getPlan(key: PlanKey): PlanDefinition | null {
  return getPlanCatalog()[key];
}

// Reverse map: which plan does a given price ID belong to? Used by the
// webhook handler to translate Stripe subscription events into our tier model.
export function planFromPriceId(priceId: string | null | undefined): PlanDefinition | null {
  if (!priceId) return null;
  const catalog = getPlanCatalog();
  for (const plan of Object.values(catalog)) {
    if (plan && plan.priceId === priceId) return plan;
  }
  return null;
}

// Subscription statuses that grant Pro access. Trial counts because the
// user has handed over a card and is in a paying funnel. past_due also
// grants access for one full grace period — Stripe will eventually flip
// to unpaid or canceled if the card never recovers, at which point access
// drops automatically through the same webhook path.
const PRO_ACCESS_STATUSES = new Set(["active", "trialing", "past_due"]);

export function statusGrantsProAccess(status: string | null | undefined): boolean {
  if (!status) return false;
  return PRO_ACCESS_STATUSES.has(status);
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
}
