-- Migration: Package 0 (cost protection) + subscription tier scaffolding.
--
-- Apply by running `npm run db:push` (which diffs the schema and applies the
-- delta automatically) OR by pasting this SQL into the Neon SQL editor.
-- The script is idempotent (IF NOT EXISTS / DO blocks) so it's safe to run
-- more than once.

-- ---------------------------------------------------------------------------
-- 1. Subscription tier columns on users
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS comped_by text;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS comped_reason text;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS comped_at timestamp;

-- ---------------------------------------------------------------------------
-- 2. api_usage_events table — powers circuit breaker, per-user token cap,
--    and per-IP throttle.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  ip_hash text,
  endpoint text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(10,6) NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_usage_created_at_idx
  ON api_usage_events (created_at);

CREATE INDEX IF NOT EXISTS api_usage_user_created_idx
  ON api_usage_events (user_id, created_at);

CREATE INDEX IF NOT EXISTS api_usage_ip_created_idx
  ON api_usage_events (ip_hash, created_at);
