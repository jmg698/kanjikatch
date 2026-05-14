import { checkPlanLimit, readPlanQuota } from "@/lib/plan-limits";

// Back-compat shim. The previous implementation enforced a flat
// 200-extractions-per-7d cap shared by all users. Package 2 replaces that
// with a per-tier monthly model (free: 10 starter + 5/month, pro: 1000/mo
// fair-use), gated through src/lib/plan-limits.ts.
//
// New code should import from "@/lib/plan-limits" directly. This file
// stays so any caller still importing `checkExtractionRateLimit` or
// `WEEKLY_EXTRACTION_LIMIT` doesn't break — but the names are now
// historical, not semantic.

/**
 * @deprecated Use checkPlanLimit(userId, "extract") for the full decision or
 * readPlanQuota(userId) for a read-only snapshot.
 */
export const WEEKLY_EXTRACTION_LIMIT = 0; // intentionally unused — kept only for old imports

/**
 * @deprecated Use checkPlanLimit(userId, "extract") which returns the full
 * decision including tier context and a user-facing reason on block.
 */
export async function checkExtractionRateLimit(
  userId: string,
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const decision = await checkPlanLimit(userId, "extract");
  return { allowed: decision.allowed, remaining: decision.remaining, limit: decision.limit };
}

/**
 * @deprecated Use readPlanQuota(userId) directly.
 */
export async function getExtractionQuota(userId: string) {
  return readPlanQuota(userId);
}
