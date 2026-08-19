import { db, reviewTracks, kanji, vocabulary } from "@/db";
import { sql, type SQL } from "drizzle-orm";

/**
 * Idempotently create meaning + reading tracks for an item.
 * Uses ON CONFLICT DO NOTHING so it's safe to call multiple times.
 */
export async function ensureReviewTracks(
  userId: string,
  itemId: string,
  itemType: "kanji" | "vocab",
) {
  await db
    .insert(reviewTracks)
    .values([
      { userId, itemId, itemType, questionType: "meaning" },
      { userId, itemId, itemType, questionType: "reading" },
    ])
    .onConflictDoNothing({ target: [reviewTracks.itemId, reviewTracks.itemType, reviewTracks.questionType] });
}

/**
 * Given a set of review tracks, compute the effective (display) confidence
 * for the parent item — the minimum across both tracks.
 */
export function computeEffectiveConfidence(
  tracks: { confidenceLevel: string }[],
): string {
  if (tracks.length === 0) return "new";
  const ord: Record<string, number> = { new: 0, learning: 1, reviewing: 2, known: 3 };
  let min = 3;
  for (const t of tracks) {
    const val = ord[t.confidenceLevel] ?? 0;
    if (val < min) min = val;
  }
  return ["new", "learning", "reviewing", "known"][min];
}

/**
 * SQL predicate: the review_tracks row's parent item is still in rotation
 * (review_status = 'active').
 *
 * Cards the user set aside — and soft-removed ones — must not surface in the
 * review queue, due counts, or the forecast. This is written as an EXISTS
 * subquery rather than a join because the parent lives in one of two tables
 * (kanji or vocabulary) and review_tracks has no foreign key to either, so a
 * query that isn't scoped to a single item_type can't join at all.
 *
 * Queries that already innerJoin kanji/vocabulary should compare
 * `<table>.reviewStatus` directly instead — cheaper and easier to read.
 *
 * Pass `itemType` when the surrounding query is scoped to one type; omit it to
 * cover both. The item_type check is included either way so the predicate is
 * correct standalone.
 */
export function itemIsActive(itemType?: "kanji" | "vocab"): SQL {
  const kanjiActive = sql`(${reviewTracks.itemType} = 'kanji' AND EXISTS (
    SELECT 1 FROM ${kanji} k
    WHERE k.id = ${reviewTracks.itemId} AND k.review_status = 'active'
  ))`;
  const vocabActive = sql`(${reviewTracks.itemType} = 'vocab' AND EXISTS (
    SELECT 1 FROM ${vocabulary} v
    WHERE v.id = ${reviewTracks.itemId} AND v.review_status = 'active'
  ))`;

  if (itemType === "kanji") return kanjiActive;
  if (itemType === "vocab") return vocabActive;
  return sql`(${kanjiActive} OR ${vocabActive})`;
}
