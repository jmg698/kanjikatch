import { db, reviewTracks } from "@/db";
import { eq, and, sql } from "drizzle-orm";

export interface ProficiencyProfile {
  estimatedJlptLevel: number | null;
  kanji: {
    total: number;
    new: number;
    learning: number;
    reviewing: number;
    known: number;
  };
  vocab: {
    total: number;
    new: number;
    learning: number;
    reviewing: number;
    known: number;
  };
  totalItems: number;
  totalKnown: number;
}

/**
 * JLPT level thresholds (approximate):
 * N5: ~80 kanji, ~800 vocab
 * N4: ~170 kanji, ~1500 vocab
 * N3: ~370 kanji, ~3750 vocab
 * N2: ~1000 kanji, ~6000 vocab
 * N1: ~2000 kanji, ~10000 vocab
 */
const JLPT_THRESHOLDS = [
  { level: 1, kanji: 2000, vocab: 10000 },
  { level: 2, kanji: 1000, vocab: 6000 },
  { level: 3, kanji: 370, vocab: 3750 },
  { level: 4, kanji: 170, vocab: 1500 },
  { level: 5, kanji: 80, vocab: 800 },
];

function estimateJlptLevel(kanjiKnown: number, vocabKnown: number): number | null {
  if (kanjiKnown === 0 && vocabKnown === 0) return null;

  for (const t of JLPT_THRESHOLDS) {
    if (kanjiKnown >= t.kanji && vocabKnown >= t.vocab) {
      return t.level;
    }
  }

  if (kanjiKnown >= 40 || vocabKnown >= 400) return 5;
  return null;
}

/**
 * Compute effective confidence per item from tracks, then bucket by level.
 * Effective confidence = MIN confidence across both tracks for each item.
 */
async function getEffectiveConfidenceCounts(userId: string, itemType: "kanji" | "vocab") {
  const allTracks = await db
    .select({
      itemId: reviewTracks.itemId,
      confidenceLevel: reviewTracks.confidenceLevel,
    })
    .from(reviewTracks)
    .where(and(eq(reviewTracks.userId, userId), eq(reviewTracks.itemType, itemType)));

  const ord: Record<string, number> = { new: 0, learning: 1, reviewing: 2, known: 3 };
  const labels = ["new", "learning", "reviewing", "known"];

  // Group tracks by item, compute MIN confidence
  const itemConfidence = new Map<string, number>();
  for (const t of allTracks) {
    const val = ord[t.confidenceLevel] ?? 0;
    const current = itemConfidence.get(t.itemId);
    if (current === undefined || val < current) {
      itemConfidence.set(t.itemId, val);
    }
  }

  // Count items per effective confidence level
  const counts: Record<string, number> = { new: 0, learning: 0, reviewing: 0, known: 0 };
  for (const val of itemConfidence.values()) {
    counts[labels[val]]++;
  }

  return counts;
}

export async function getUserProficiency(userId: string): Promise<ProficiencyProfile> {
  const [kanjiCounts, vocabCounts] = await Promise.all([
    getEffectiveConfidenceCounts(userId, "kanji"),
    getEffectiveConfidenceCounts(userId, "vocab"),
  ]);

  const kanjiTotal = Object.values(kanjiCounts).reduce((a, b) => a + b, 0);
  const vocabTotal = Object.values(vocabCounts).reduce((a, b) => a + b, 0);

  const kanjiKnown = (kanjiCounts["known"] ?? 0) + (kanjiCounts["reviewing"] ?? 0);
  const vocabKnown = (vocabCounts["known"] ?? 0) + (vocabCounts["reviewing"] ?? 0);

  return {
    estimatedJlptLevel: estimateJlptLevel(kanjiKnown, vocabKnown),
    kanji: {
      total: kanjiTotal,
      new: kanjiCounts["new"] ?? 0,
      learning: kanjiCounts["learning"] ?? 0,
      reviewing: kanjiCounts["reviewing"] ?? 0,
      known: kanjiCounts["known"] ?? 0,
    },
    vocab: {
      total: vocabTotal,
      new: vocabCounts["new"] ?? 0,
      learning: vocabCounts["learning"] ?? 0,
      reviewing: vocabCounts["reviewing"] ?? 0,
      known: vocabCounts["known"] ?? 0,
    },
    totalItems: kanjiTotal + vocabTotal,
    totalKnown: kanjiKnown + vocabKnown,
  };
}
