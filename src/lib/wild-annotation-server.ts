import "server-only";

import { and, eq, gt } from "drizzle-orm";

import { db, kanji, vocabulary } from "@/db";
import type { StudiedCorpus } from "./wild-annotation";

/**
 * Load the user's studied corpus from the database.
 *
 * "Studied" = reviewCount > 0. Items that exist in the library but have
 * never been reviewed are intentionally excluded (see JAC-15 — don't claim
 * the user knows a compound they haven't actually practiced).
 */
export async function loadStudiedCorpus(userId: string): Promise<StudiedCorpus> {
  const [studiedVocab, studiedKanjiRows] = await Promise.all([
    db
      .select({ word: vocabulary.word })
      .from(vocabulary)
      .where(and(eq(vocabulary.userId, userId), gt(vocabulary.reviewCount, 0))),
    db
      .select({ character: kanji.character })
      .from(kanji)
      .where(and(eq(kanji.userId, userId), gt(kanji.reviewCount, 0))),
  ]);

  return {
    studiedWords: new Set(studiedVocab.map((v) => v.word)),
    studiedKanji: new Set(studiedKanjiRows.map((k) => k.character)),
  };
}
