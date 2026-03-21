/**
 * Migration: Populate review_tracks from existing SRS data on kanji/vocab rows.
 *
 * For each kanji and vocabulary item, creates two tracks (meaning + reading)
 * inheriting the item's current SRS state. This gives both tracks the same
 * starting point — after a few reviews they'll naturally diverge.
 *
 * Usage:
 *   npx tsx scripts/migrate-srs-tracks.ts
 *
 * Prerequisites:
 *   1. Run `npm run db:push` first to create the review_tracks table
 *   2. Set DATABASE_URL in .env
 *
 * This script is idempotent — it uses ON CONFLICT DO NOTHING so it's safe
 * to run multiple times.
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set in .env");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function migrate() {
  console.log("Starting SRS track migration...\n");

  const [kanjiCount] = await sql`SELECT COUNT(*)::int AS count FROM kanji`;
  const [vocabCount] = await sql`SELECT COUNT(*)::int AS count FROM vocabulary`;

  console.log(`Found ${kanjiCount.count} kanji items and ${vocabCount.count} vocabulary items.`);

  const [existingTracks] = await sql`SELECT COUNT(*)::int AS count FROM review_tracks`;
  if (existingTracks.count > 0) {
    console.log(`Note: ${existingTracks.count} tracks already exist. New tracks will be added with ON CONFLICT DO NOTHING.\n`);
  }

  console.log("Migrating kanji SRS data...");
  await sql`
    INSERT INTO review_tracks (user_id, item_id, item_type, question_type,
      next_review_at, interval_days, ease_factor, review_count,
      times_correct, last_reviewed_at, confidence_level)
    SELECT
      k.user_id, k.id, 'kanji', qt.question_type,
      k.next_review_at, k.interval_days, k.ease_factor, k.review_count,
      k.times_correct, k.last_reviewed_at, k.confidence_level
    FROM kanji k
    CROSS JOIN (VALUES ('meaning'), ('reading')) AS qt(question_type)
    ON CONFLICT (item_id, item_type, question_type) DO NOTHING
  `;
  console.log(`  Created kanji tracks (${kanjiCount.count} items × 2 tracks each)`);

  console.log("Migrating vocabulary SRS data...");
  await sql`
    INSERT INTO review_tracks (user_id, item_id, item_type, question_type,
      next_review_at, interval_days, ease_factor, review_count,
      times_correct, last_reviewed_at, confidence_level)
    SELECT
      v.user_id, v.id, 'vocab', qt.question_type,
      v.next_review_at, v.interval_days, v.ease_factor, v.review_count,
      v.times_correct, v.last_reviewed_at, v.confidence_level
    FROM vocabulary v
    CROSS JOIN (VALUES ('meaning'), ('reading')) AS qt(question_type)
    ON CONFLICT (item_id, item_type, question_type) DO NOTHING
  `;
  console.log(`  Created vocabulary tracks (${vocabCount.count} items × 2 tracks each)`);

  const [finalCount] = await sql`SELECT COUNT(*)::int AS count FROM review_tracks`;
  console.log(`\nMigration complete! Total review tracks: ${finalCount.count}`);
  console.log("Both meaning and reading tracks now share the same SRS state.");
  console.log("They will naturally diverge as the user reviews each track independently.\n");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
