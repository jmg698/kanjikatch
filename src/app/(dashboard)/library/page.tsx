import { db, kanji, vocabulary, sentences } from "@/db";
import { getCurrentUserId } from "@/lib/auth";
import { eq, count } from "drizzle-orm";
import { LibraryClient } from "@/components/library/library-client";

async function getLibraryCounts(userId: string) {
  const [kanjiCount, vocabCount, sentenceCount] = await Promise.all([
    db.select({ total: count() }).from(kanji).where(eq(kanji.userId, userId)),
    db.select({ total: count() }).from(vocabulary).where(eq(vocabulary.userId, userId)),
    db.select({ total: count() }).from(sentences).where(eq(sentences.userId, userId)),
  ]);

  return {
    kanji: kanjiCount[0].total,
    vocabulary: vocabCount[0].total,
    sentences: sentenceCount[0].total,
  };
}

export default async function LibraryPage() {
  const userId = await getCurrentUserId();
  const counts = await getLibraryCounts(userId);

  return <LibraryClient initialCounts={counts} />;
}
