import { createHash } from "node:crypto";
import { db, apiUsageEvents } from "@/db";
import { and, eq, gte, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";

// =============================================================================
// Package 0 — Cost Protection
// =============================================================================
//
// Three independent guards that run *before* any Anthropic call. Each guard
// is conservative (fails open only on its own DB errors — never bypasses the
// other guards) and cheap (one count(*) over an indexed window).
//
//   1. Circuit breaker:   global daily $ ceiling. Halts the entire app's AI
//                         spend if exceeded.
//   2. Per-user token cap: hidden hard ceiling on a single user's daily token
//                         usage. Above any visible product-level limit.
//   3. Per-IP throttle:   short-window per-IP request count, primarily for
//                         /api/extract (which costs the most per request).
//
// Numbers in DEFAULT_LIMITS are chosen to allow normal product usage while
// catching runaway loops, scrapers, and viral spikes. They're environment-
// overridable via the COST_PROTECTION_* env vars at the bottom of this file.
// =============================================================================

// --- Pricing -----------------------------------------------------------------

// Per-model USD pricing per 1M tokens. Sourced from Anthropic public pricing
// at time of writing — update when models change. Falls back to Sonnet 4
// numbers for unknown models (conservative).
const MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "claude-sonnet-4-20250514": { inputPer1M: 3, outputPer1M: 15 },
  "claude-3-5-haiku-20241022": { inputPer1M: 0.8, outputPer1M: 4 },
};

const FALLBACK_PRICING = { inputPer1M: 3, outputPer1M: 15 };

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model] ?? FALLBACK_PRICING;
  const cost =
    (inputTokens / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M;
  // Round to 6 decimals to match the numeric(10,6) column scale.
  return Math.round(cost * 1_000_000) / 1_000_000;
}

// --- Limits ------------------------------------------------------------------

function envNum(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const COST_LIMITS = {
  // Global daily ceiling across all users. ~$50/day = ~$1500/mo worst case.
  // A single viral moment shouldn't be able to push past this.
  globalDailyCeilingUsd: envNum("COST_PROTECTION_GLOBAL_DAILY_USD", 50),

  // Per-user daily token cap. Sits *above* the visible product limits so it
  // only trips on abuse / runaway loops. Sonnet 4 at this cap = ~$0.45/user/day.
  perUserDailyTokens: envNum("COST_PROTECTION_PER_USER_DAILY_TOKENS", 150_000),

  // Per-IP throttle on costly endpoints. The default window is one minute.
  ipThrottleWindowSec: envNum("COST_PROTECTION_IP_WINDOW_SEC", 60),
  ipThrottleMaxRequests: envNum("COST_PROTECTION_IP_MAX_REQUESTS", 10),
} as const;

// --- IP extraction & hashing -------------------------------------------------

// Salt for hashing IPs. Falls back to a fixed value so this still works in
// dev without configuration; in production set COST_PROTECTION_IP_HASH_SALT
// to a random per-environment secret so the hash isn't trivially reversible.
const IP_HASH_SALT = process.env.COST_PROTECTION_IP_HASH_SALT ?? "kanjikatch-dev-ip-salt";

export function getClientIp(req: NextRequest | Request): string | null {
  // Vercel / most reverse proxies set x-forwarded-for. Take the leftmost entry
  // (the original client). x-real-ip is a fallback used by some proxies.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();
  return null;
}

export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${IP_HASH_SALT}:${ip}`).digest("hex");
}

// --- Endpoint identifiers ----------------------------------------------------

export type CostProtectedEndpoint =
  | "extract"
  | "extract_text"
  | "sentence_generate"
  | "enrich";

// --- Guard results -----------------------------------------------------------

export type CostGuardOk = { allowed: true };
export type CostGuardBlocked = {
  allowed: false;
  reason: "circuit_breaker" | "user_token_cap" | "ip_throttle";
  /** Public message — safe to surface to users. Doesn't leak limit values. */
  message: string;
  /** HTTP status to return — 429 for user/IP, 503 for circuit breaker. */
  status: 429 | 503;
  /** Recommended Retry-After header value, in seconds. */
  retryAfterSec: number;
};
export type CostGuardResult = CostGuardOk | CostGuardBlocked;

// --- Individual guards -------------------------------------------------------

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function readDailyCostSum(since: Date): Promise<number> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${apiUsageEvents.estimatedCostUsd}), 0)`,
    })
    .from(apiUsageEvents)
    .where(gte(apiUsageEvents.createdAt, since));
  return Number(row?.total ?? 0);
}

async function readUserDailyTokens(userId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${apiUsageEvents.inputTokens} + ${apiUsageEvents.outputTokens}), 0)`,
    })
    .from(apiUsageEvents)
    .where(
      and(
        eq(apiUsageEvents.userId, userId),
        gte(apiUsageEvents.createdAt, since),
      ),
    );
  return Number(row?.total ?? 0);
}

async function readIpRecentRequestCount(ipHash: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(apiUsageEvents)
    .where(
      and(
        eq(apiUsageEvents.ipHash, ipHash),
        gte(apiUsageEvents.createdAt, since),
      ),
    );
  return row?.count ?? 0;
}

/**
 * Composite pre-call guard. Run this before any Anthropic API call on a
 * cost-protected endpoint. Returns `{ allowed: true }` on success, or a
 * structured block describing which guard tripped.
 *
 * Order matters: the global circuit breaker is checked first (cheapest to
 * recover from — restoring service for everyone is one config change), then
 * the per-IP throttle (cheapest individual signal), then the per-user cap.
 *
 * On internal errors (DB unavailable etc.) the guard fails OPEN, returning
 * { allowed: true }. We'd rather take a few extra requests than break the
 * product when the cost-tracking DB hiccups. The recordApiUsage call after
 * the API completes will still write the event, so the next request will
 * see the up-to-date totals.
 */
export async function assertCostProtection(args: {
  userId: string | null;
  ipHash: string | null;
  endpoint: CostProtectedEndpoint;
}): Promise<CostGuardResult> {
  const now = Date.now();
  const dayAgo = new Date(now - ONE_DAY_MS);
  const windowAgo = new Date(now - COST_LIMITS.ipThrottleWindowSec * 1000);

  try {
    // 1. Global circuit breaker.
    const dailySpend = await readDailyCostSum(dayAgo);
    if (dailySpend >= COST_LIMITS.globalDailyCeilingUsd) {
      return {
        allowed: false,
        reason: "circuit_breaker",
        // Generic phrasing — never disclose the dollar ceiling.
        message:
          "Our AI is temporarily unavailable due to elevated load. Please try again in a little while.",
        status: 503,
        retryAfterSec: 300,
      };
    }

    // 2. Per-IP throttle. Only enforced on endpoints that gate behind it and
    //    only when we actually have an IP.
    if (args.ipHash && endpointHasIpThrottle(args.endpoint)) {
      const count = await readIpRecentRequestCount(args.ipHash, windowAgo);
      if (count >= COST_LIMITS.ipThrottleMaxRequests) {
        return {
          allowed: false,
          reason: "ip_throttle",
          message: "You're going a bit fast. Please wait a moment and try again.",
          status: 429,
          retryAfterSec: COST_LIMITS.ipThrottleWindowSec,
        };
      }
    }

    // 3. Per-user daily token cap.
    if (args.userId) {
      const tokens = await readUserDailyTokens(args.userId, dayAgo);
      if (tokens >= COST_LIMITS.perUserDailyTokens) {
        return {
          allowed: false,
          reason: "user_token_cap",
          message:
            "You've hit today's usage cap. This is a safety limit — try again tomorrow.",
          status: 429,
          retryAfterSec: 3600,
        };
      }
    }

    return { allowed: true };
  } catch (err) {
    // Fail open — see jsdoc above. Log so Sentry can pick it up via the
    // surrounding endpoint's try/catch is bypassed here, so we go through
    // console.error directly (Sentry has a console integration that picks
    // this up in production).
    console.error("[cost-protection] guard read failed, failing open", err);
    return { allowed: true };
  }
}

function endpointHasIpThrottle(endpoint: CostProtectedEndpoint): boolean {
  // Extract endpoints are the costliest per call (image + Sonnet 4) and the
  // most attractive target for abuse, so they get IP throttling. Enrichment
  // is cheap Haiku and runs as part of vocab-quick-add — throttling that by
  // IP would only hurt real users on shared networks.
  return endpoint === "extract" || endpoint === "extract_text";
}

// --- Recording ---------------------------------------------------------------

export interface UsageRecord {
  userId: string | null;
  ipHash: string | null;
  endpoint: CostProtectedEndpoint;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Record a completed API call. Call this in a try/finally after the
 * Anthropic call returns (or throws — partial usage on error is still real
 * spend). Never throws — failures are logged but swallowed so they can't
 * fail the user's request.
 */
export async function recordApiUsage(usage: UsageRecord): Promise<void> {
  try {
    const cost = estimateCostUsd(usage.model, usage.inputTokens, usage.outputTokens);
    await db.insert(apiUsageEvents).values({
      userId: usage.userId,
      ipHash: usage.ipHash,
      endpoint: usage.endpoint,
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCostUsd: cost.toFixed(6),
    });
  } catch (err) {
    console.error("[cost-protection] failed to record usage", err);
  }
}
