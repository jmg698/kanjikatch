import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import type { SubscriptionTier } from "@/db/schema";

// Feature-gate plumbing for the Pro tier. Today nothing on the user-facing
// side actually gates on these — the walls in PRO_TIER_PLAN.md are not yet
// live. The helpers here exist so endpoints can already start reading the
// tier and so flipping a wall on later is a one-line change.

export interface TierContext {
  tier: SubscriptionTier;
  isPro: boolean;        // tier === 'pro' || tier === 'pro_comped'
  isComped: boolean;     // tier === 'pro_comped' — suppresses payment UI
  isFree: boolean;       // tier === 'free'
}

// Limits referenced by future walls. Centralized here so we have one source
// of truth when we wire the walls up. Numbers come from PRO_TIER_PLAN.md.
export const TIER_LIMITS = {
  free: {
    // Starter grant + monthly refill, no rollover. The actual monthly-refill
    // accounting is not yet implemented — when it lands, it'll read these
    // numbers from here.
    extractionsStarter: 10,
    extractionsMonthly: 5,
    sentencesPerSession: 2,
    sentencesPersonalized: false,
    audio: false,
  },
  pro: {
    // "Unlimited" is paired with a fair-use clause + hard cap below.
    extractionsMonthly: Infinity,
    sentencesPerSession: 5,
    sentencesPersonalized: true,
    audio: true,
    dailyGenerationCap: 200, // server-enforced fair-use cap
  },
} as const;

function normalizeTier(raw: string | null | undefined): SubscriptionTier {
  if (raw === "pro" || raw === "pro_comped") return raw;
  return "free";
}

function buildContext(tier: SubscriptionTier): TierContext {
  return {
    tier,
    isPro: tier === "pro" || tier === "pro_comped",
    isComped: tier === "pro_comped",
    isFree: tier === "free",
  };
}

/**
 * Load the tier for a user. If the user row is missing (race with Clerk
 * webhook), returns a free context — callers should still create the row
 * via their existing upsert path. Never throws.
 */
export async function getTierContext(userId: string): Promise<TierContext> {
  const [row] = await db
    .select({ subscriptionTier: users.subscriptionTier })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return buildContext(normalizeTier(row?.subscriptionTier));
}

export function tierContextFromValue(raw: string | null | undefined): TierContext {
  return buildContext(normalizeTier(raw));
}
