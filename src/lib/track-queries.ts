import { db, reviewTracks } from "@/db";

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
