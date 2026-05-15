-- Migration: User reports / feedback.
--
-- Apply via `npm run db:push` or paste into the Neon SQL editor.
-- Idempotent (IF NOT EXISTS).
--
-- Stores user-submitted reports about extraction failures (and any future
-- feedback categories). source_image_id is nullable because some reports can
-- be filed before a source_images row exists (upload errors, auth failures,
-- pre-insert validation errors). The reporter still gets a "Report this"
-- button on the error screen — see capture-input.tsx and /api/feedback.

CREATE TABLE IF NOT EXISTS user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_image_id uuid REFERENCES source_images(id) ON DELETE SET NULL,
  category text NOT NULL,
  note text,
  user_agent text,
  -- Snapshot of source_images.error_message (or the client-side message the
  -- user actually saw) at report time. Keeps the context attached even if
  -- the source row is later deleted or overwritten.
  error_message_snapshot text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_reports_user_id_idx ON user_reports (user_id);
CREATE INDEX IF NOT EXISTS user_reports_created_at_idx ON user_reports (created_at);
