-- Migration: Card triage ("Set aside").
--
-- Apply via `npm run db:push` or paste into the Neon SQL editor.
-- Idempotent.
--
-- Lets a user pull a card out of rotation mid-review without grading it, then
-- decide later whether to delete it or keep it parked. Adds to both kanji and
-- vocabulary:
--
--   1. review_status — 'active' | 'set_aside' | 'removed'.
--      The review queue serves only 'active' rows. 'removed' is a SOFT delete:
--      review_tracks / review_history / generated_sentence_targets all
--      reference item_id with no foreign key, so a hard delete would orphan
--      them. Soft delete also means a later capture of the same character/word
--      won't resurrect an item the user deliberately removed — the upsert in
--      api/extract/save doesn't touch this column.
--
--   2. flag_reason — 'not_needed' | 'bad_data' | NULL.
--      Captured when the card is set aside, because it routes the card:
--      'bad_data' also queues vocabulary for re-enrichment.
--
--   3. flagged_at — when the user set it aside (not when it was resolved).

ALTER TABLE kanji
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS flag_reason text NULL,
  ADD COLUMN IF NOT EXISTS flagged_at timestamp NULL;

ALTER TABLE vocabulary
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS flag_reason text NULL,
  ADD COLUMN IF NOT EXISTS flagged_at timestamp NULL;

-- Supports the library's "Set aside" filter and the queue's active-item check.
CREATE INDEX IF NOT EXISTS kanji_user_status_idx
  ON kanji (user_id, review_status);

CREATE INDEX IF NOT EXISTS vocabulary_user_status_idx
  ON vocabulary (user_id, review_status);
