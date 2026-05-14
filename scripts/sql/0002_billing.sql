-- Migration: Package 2 (billing & subscriptions).
--
-- Apply by running `npm run db:push` OR by pasting this SQL into the Neon SQL
-- editor. The script is idempotent (IF NOT EXISTS / DO blocks) so it's safe
-- to run more than once.
--
-- See PRO_TIER_PLAN.md and LAUNCH_PLAN.md (Package 2) for the surrounding
-- design. Tier values, comped metadata, and api_usage_events were added in
-- migration 0001 — this migration only adds billing-specific state and the
-- per-period extraction counters that the new walls need.

-- ---------------------------------------------------------------------------
-- 1. Stripe billing columns on users
-- ---------------------------------------------------------------------------
-- stripe_customer_id is created at first checkout and reused for the lifetime
-- of the account. The remaining fields mirror the active subscription and are
-- maintained by the Stripe webhook handler.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Postgres treats multiple NULLs as distinct under the default
-- NULLS DISTINCT semantics, so a plain unique index is fine here:
-- many users with no customer yet (NULL) coexist; once set, the value
-- is guaranteed unique.
CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_customer_id_idx
  ON users (stripe_customer_id);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- Mirrors Stripe Subscription.status: active | trialing | past_due | canceled
-- | incomplete | incomplete_expired | unpaid | paused.
-- NULL means the user has never started a subscription.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_status text;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS current_period_end timestamp;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trial_end timestamp;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 2. Per-period extraction counters (drive the free-tier wall)
-- ---------------------------------------------------------------------------
-- Free users get 10 starter extractions (one-time, drained first) plus
-- TIER_LIMITS.free.extractionsMonthly per calendar month (UTC). The counter
-- resets when extractions_period_start falls in a previous month — see
-- src/lib/plan-limits.ts for the read/reset logic.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS extractions_used_this_period integer NOT NULL DEFAULT 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS extractions_period_start timestamp NOT NULL DEFAULT now();

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS starter_extractions_used integer NOT NULL DEFAULT 0;
