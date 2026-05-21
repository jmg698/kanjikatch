import { db, kanji, vocabulary, sentences, sourceImages } from "@/db";
import { getCurrentUserId } from "@/lib/auth";
import { and, eq, count } from "drizzle-orm";
import { LibraryClient } from "@/components/library/library-client";

async function getLibraryCounts(userId: string) {
  const [kanjiCount, vocabCount, sentenceCount, sampleSources] = await Promise.all([
    db.select({ total: count() }).from(kanji).where(eq(kanji.userId, userId)),
    db.select({ total: count() }).from(vocabulary).where(eq(vocabulary.userId, userId)),
    db.select({ total: count() }).from(sentences).where(eq(sentences.userId, userId)),
    // IDs of source rows the user borrowed from the onboarding sample set.
    // Used client-side to flag derived cards with the "guided sample" pill.
    db
      .select({ id: sourceImages.id })
      .from(sourceImages)
      .where(
        and(
          eq(sourceImages.userId, userId),
          eq(sourceImages.isOnboardingSample, true),
        ),
      ),
  ]);

  return {
    kanji: kanjiCount[0].total,
    vocabulary: vocabCount[0].total,
    sentences: sentenceCount[0].total,
    sampleSourceIds: sampleSources.map((s) => s.id),
  };
}

export default async function LibraryPage() {
  const userId = await getCurrentUserId();
  const counts = await getLibraryCounts(userId);

  return <LibraryClient initialCounts={counts} />;
}
