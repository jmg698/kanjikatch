import { db, users } from "@/db";
import { eq, sql } from "drizzle-orm";
import { getTierContext, TIER_LIMITS, type TierContext } from "@/lib/tiers";

// Plan-aware feature gates. This module owns the actual wall logic for
// Package 2 — `tiers.ts` just answers "what tier is this user on?" and
// "what limits does the tier have?". This file decides "does this user
// have headroom for this action right now?" by combining the tier with
// per-user state (monthly counters, etc.).

export type GatedAction = "extract";

export interface PlanLimitDecision {
  allowed: boolean;
  // remaining / limit are user-facing — the existing capture UI surfaces
  // them in the quota banner and the limit-reached error message.
  remaining: number;
  limit: number;
  tier: TierContext;
  // When the gate is hit, copy that the client can render verbatim.
  reason?: string;
}

// Stripe periods are per-month; counting calendar months in UTC keeps the
// math simple and matches the "Monthly extraction reset" email.
function startOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

// Pro fair-use cap on extractions. Cost protection already covers the
// catastrophic case (per-user daily token cap). This is a softer ceiling
// so a single Pro user can't single-handedly burn a month of margin.
// Calibrated well above any plausible legitimate usage.
const PRO_FAIR_USE_MONTHLY_EXTRACTIONS = 1000;

interface ExtractionAccount {
  // Counts that have already been folded forward to the current month.
  used: number;
  starterUsed: number;
  // The period boundary in effect when these counters were read.
  // The DB row may still reflect a stale `extractions_period_start`;
  // commitExtraction() advances it on the first write of a new month.
  periodStart: Date;
  // The user's createdAt — used to compute starter eligibility.
  createdAt: Date;
}

async function loadExtractionAccount(userId: string): Promise<ExtractionAccount | null> {
  const [row] = await db
    .select({
      used: users.extractionsUsedThisPeriod,
      starterUsed: users.starterExtractionsUsed,
      periodStart: users.extractionsPeriodStart,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) return null;

  const now = new Date();
  const currentPeriodStart = startOfMonthUtc(now);
  if (!isSameMonth(row.periodStart, now)) {
    // Stale period — counters are conceptually 0 for the current month.
    // We don't write here; commitExtraction handles the persist on next
    // successful action so a pure read stays read-only.
    return {
      used: 0,
      starterUsed: row.starterUsed,
      periodStart: currentPeriodStart,
      createdAt: row.createdAt,
    };
  }

  return {
    used: row.used,
    starterUsed: row.starterUsed,
    periodStart: row.periodStart,
    createdAt: row.createdAt,
  };
}

function freeExtractionCapacity(account: ExtractionAccount): { remaining: number; limit: number } {
  const monthly = TIER_LIMITS.free.extractionsMonthly;
  const starterGrant = TIER_LIMITS.free.extractionsStarter;

  const monthlyRemaining = Math.max(0, monthly - account.used);
  const starterRemaining = Math.max(0, starterGrant - account.starterUsed);

  // The starter pool drains first when a user extracts (see commitExtraction),
  // and rolls over forever — it's a one-time grant. The displayed "limit" is
  // the sum of any starter still in the pool plus the monthly allotment, so
  // a brand-new user sees "15 left" rather than "5 left, plus 10 mystery".
  return {
    remaining: monthlyRemaining + starterRemaining,
    limit: monthly + starterRemaining,
  };
}

export async function checkPlanLimit(
  userId: string,
  action: GatedAction,
): Promise<PlanLimitDecision> {
  const tier = await getTierContext(userId);

  if (action !== "extract") {
    // Future actions (e.g. "generate_personalized_sentence") will branch here.
    return { allowed: true, remaining: Infinity, limit: Infinity, tier };
  }

  // Pro & comped — fair-use cap only, no user-facing wall under normal use.
  if (tier.isPro) {
    const account = await loadExtractionAccount(userId);
    const used = account?.used ?? 0;
    const limit = PRO_FAIR_USE_MONTHLY_EXTRACTIONS;
    const remaining = Math.max(0, limit - used);
    return {
      allowed: remaining > 0,
      remaining,
      limit,
      tier,
      reason: remaining > 0
        ? undefined
        : "You've hit the monthly fair-use cap on extractions. Please get in touch — we'll raise it.",
    };
  }

  // Free tier.
  const account = await loadExtractionAccount(userId);
  if (!account) {
    // Race with Clerk webhook — the user row will be created on next write.
    // Treat as a fresh free user with full starter pool.
    return {
      allowed: true,
      remaining: TIER_LIMITS.free.extractionsStarter + TIER_LIMITS.free.extractionsMonthly,
      limit: TIER_LIMITS.free.extractionsStarter + TIER_LIMITS.free.extractionsMonthly,
      tier,
    };
  }

  const { remaining, limit } = freeExtractionCapacity(account);
  return {
    allowed: remaining > 0,
    remaining,
    limit,
    tier,
    reason: remaining > 0
      ? undefined
      : `You've used your ${TIER_LIMITS.free.extractionsMonthly} extractions for this month. Upgrade to Pro for unlimited extractions.`,
  };
}

// Read-only variant used by the quota endpoint. Same answer as checkPlanLimit
// without spending a tier resolution if it's already in hand.
export async function readPlanQuota(userId: string): Promise<{ remaining: number; limit: number; tier: TierContext }> {
  const decision = await checkPlanLimit(userId, "extract");
  return { remaining: decision.remaining, limit: decision.limit, tier: decision.tier };
}

// Atomically increment the user's extraction counter after a successful
// extract. Caller MUST only call this once per successful extraction — the
// counter feeds the wall directly.
//
// Drains starter pool first, then the monthly counter. Resets the monthly
// counter if the row's period_start is stale (lazy month roll-over).
export async function commitExtraction(userId: string): Promise<void> {
  const tier = await getTierContext(userId);
  // For Pro users we still bump the counter so the fair-use cap can read it,
  // but we skip the starter-pool logic (irrelevant for Pro).
  if (tier.isPro) {
    await db
      .update(users)
      .set({
        extractionsUsedThisPeriod: sql`
          CASE
            WHEN date_trunc('month', ${users.extractionsPeriodStart}) = date_trunc('month', now() AT TIME ZONE 'UTC')
              THEN ${users.extractionsUsedThisPeriod} + 1
            ELSE 1
          END
        `,
        extractionsPeriodStart: sql`date_trunc('month', now() AT TIME ZONE 'UTC')`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return;
  }

  // Free: drain starter pool first, then monthly. The CASE handles month
  // roll-over atomically so two requests at midnight can't double-spend.
  const starterCap = TIER_LIMITS.free.extractionsStarter;
  await db
    .update(users)
    .set({
      starterExtractionsUsed: sql`
        LEAST(${starterCap}, ${users.starterExtractionsUsed} + 1)
      `,
      extractionsUsedThisPeriod: sql`
        CASE
          WHEN ${users.starterExtractionsUsed} < ${starterCap} THEN
            CASE
              WHEN date_trunc('month', ${users.extractionsPeriodStart}) = date_trunc('month', now() AT TIME ZONE 'UTC')
                THEN ${users.extractionsUsedThisPeriod}
              ELSE 0
            END
          ELSE
            CASE
              WHEN date_trunc('month', ${users.extractionsPeriodStart}) = date_trunc('month', now() AT TIME ZONE 'UTC')
                THEN ${users.extractionsUsedThisPeriod} + 1
              ELSE 1
            END
        END
      `,
      extractionsPeriodStart: sql`date_trunc('month', now() AT TIME ZONE 'UTC')`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
