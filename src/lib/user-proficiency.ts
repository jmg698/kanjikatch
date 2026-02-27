import { db, kanji, vocabulary } from "@/db";
import { eq, sql } from "drizzle-orm";

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

  // Below N5 — estimate based on progress toward N5
  if (kanjiKnown >= 40 || vocabKnown >= 400) return 5;
  return null;
}

export async function getUserProficiency(userId: string): Promise<ProficiencyProfile> {
  const [kanjiConf, vocabConf] = await Promise.all([
    db.select({
      level: kanji.confidenceLevel,
      count: sql<number>`count(*)::int`,
    })
    .from(kanji)
    .where(eq(kanji.userId, userId))
    .groupBy(kanji.confidenceLevel),

    db.select({
      level: vocabulary.confidenceLevel,
      count: sql<number>`count(*)::int`,
    })
    .from(vocabulary)
    .where(eq(vocabulary.userId, userId))
    .groupBy(vocabulary.confidenceLevel),
  ]);

  const kanjiByLevel: Record<string, number> = {};
  let kanjiTotal = 0;
  for (const row of kanjiConf) {
    kanjiByLevel[row.level] = row.count;
    kanjiTotal += row.count;
  }

  const vocabByLevel: Record<string, number> = {};
  let vocabTotal = 0;
  for (const row of vocabConf) {
    vocabByLevel[row.level] = row.count;
    vocabTotal += row.count;
  }

  const kanjiKnown = (kanjiByLevel["known"] ?? 0) + (kanjiByLevel["reviewing"] ?? 0);
  const vocabKnown = (vocabByLevel["known"] ?? 0) + (vocabByLevel["reviewing"] ?? 0);

  return {
    estimatedJlptLevel: estimateJlptLevel(kanjiKnown, vocabKnown),
    kanji: {
      total: kanjiTotal,
      new: kanjiByLevel["new"] ?? 0,
      learning: kanjiByLevel["learning"] ?? 0,
      reviewing: kanjiByLevel["reviewing"] ?? 0,
      known: kanjiByLevel["known"] ?? 0,
    },
    vocab: {
      total: vocabTotal,
      new: vocabByLevel["new"] ?? 0,
      learning: vocabByLevel["learning"] ?? 0,
      reviewing: vocabByLevel["reviewing"] ?? 0,
      known: vocabByLevel["known"] ?? 0,
    },
    totalItems: kanjiTotal + vocabTotal,
    totalKnown: kanjiKnown + vocabKnown,
  };
}
