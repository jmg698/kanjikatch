-- Migration: Onboarding state plumbing.
--
-- Apply via `npm run db:push` or paste into the Neon SQL editor.
-- Idempotent.
--
-- See ONBOARDING_PLAN.md for the full spec. This migration adds:
--
--   1. users.onboarding_tour_status — drives the /welcome redirect gate.
--      Values: 'pending' | 'in_progress' | 'completed' | 'skipped'.
--      Existing users are backfilled to 'completed' so they never see the
--      tour. New rows default to 'pending'.
--
--   2. users.welcome_started_at — set when the user first lands on /welcome.
--      Used by the 7-minute time-guardrail fallback (Plan §9).
--
--   3. source_images.is_onboarding_sample — flag for sample-derived sources
--      so the library can render the "guided sample" pill and offer one-tap
--      removal in settings.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_tour_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS welcome_started_at timestamp NULL;

-- Backfill existing users — they've already used the app, don't show the tour.
UPDATE users SET onboarding_tour_status = 'completed' WHERE onboarding_tour_status = 'pending';

ALTER TABLE source_images
  ADD COLUMN IF NOT EXISTS is_onboarding_sample boolean NOT NULL DEFAULT false;
