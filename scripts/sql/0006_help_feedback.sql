-- Migration: Help center article feedback.
--
-- Apply via `npm run db:push` or paste into the Neon SQL editor.
-- Idempotent (IF NOT EXISTS).
--
-- One row per "Was this article helpful?" vote on /help/[slug]. The help
-- center is public, so user_id is nullable; ip_hash (sha256 with the cost
-- protection salt, never the raw IP) throttles anonymous spam.

CREATE TABLE IF NOT EXISTS help_article_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_slug text NOT NULL,
  helpful boolean NOT NULL,
  comment text,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  ip_hash text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS help_feedback_slug_created_idx ON help_article_feedback (article_slug, created_at);
CREATE INDEX IF NOT EXISTS help_feedback_ip_created_idx ON help_article_feedback (ip_hash, created_at);

-- Handy for reviewing results:
--   SELECT article_slug,
--          count(*) FILTER (WHERE helpful) AS yes,
--          count(*) FILTER (WHERE NOT helpful) AS no
--   FROM help_article_feedback GROUP BY article_slug ORDER BY no DESC;
