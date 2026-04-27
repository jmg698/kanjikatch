import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { db, sourceImages, kanji, vocabulary, sentences } from "@/db";
import { extractionResultSchema } from "@/lib/validations";
import { ensureReviewTracks } from "@/lib/track-queries";
import { sqlTextArray } from "@/lib/pg-text-array";
import { eq, and, sql } from "drizzle-orm";

const saveSchema = z.object({
  sourceImageId: z.string().uuid(),
  ...extractionResultSchema.shape,
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = saveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { sourceImageId, kanji: kanjiItems, vocabulary: vocabItems, sentences: sentenceItems } = parsed.data;

    const [source] = await db
      .select()
      .from(sourceImages)
      .where(and(eq(sourceImages.id, sourceImageId), eq(sourceImages.userId, userId)))
      .limit(1);

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    if (source.processed) {
      return NextResponse.json(
        { error: "This capture has already been saved." },
        { status: 409 }
      );
    }

    const counts = {
      kanji: { total: 0, new: 0, existing: 0 },
      vocabulary: { total: 0, new: 0, existing: 0 },
      sentences: 0,
    };
    const items: {
      kanji: { text: string; isNew: boolean }[];
      vocabulary: { text: string; reading: string; isNew: boolean }[];
    } = { kanji: [], vocabulary: [] };

    for (const k of kanjiItems) {
      const newMeanings = k.meanings;
      const newOn = k.readingsOn ?? [];
      const newKun = k.readingsKun ?? [];
      const [row] = await db
        .insert(kanji)
        .values({
          userId,
          character: k.character,
          meanings: newMeanings,
          readingsOn: newOn,
          readingsKun: newKun,
          jlptLevel: k.jlptLevel ?? null,
          strokeCount: k.strokeCount ?? null,
          sourceImageIds: [sourceImageId],
          timesSeen: 1,
        })
        .onConflictDoUpdate({
          target: [kanji.userId, kanji.character],
          set: {
            lastSeenAt: new Date(),
            timesSeen: sql`${kanji.timesSeen} + 1`,
            sourceImageIds: sql`array_append(${kanji.sourceImageIds}, ${sourceImageId}::uuid)`,
            meanings: sql`(SELECT coalesce(array_agg(DISTINCT val), '{}') FROM unnest(${kanji.meanings}::text[] || ${sqlTextArray(newMeanings)}) AS val)`,
            readingsOn: sql`(SELECT coalesce(array_agg(DISTINCT val), '{}') FROM unnest(${kanji.readingsOn}::text[] || ${sqlTextArray(newOn)}) AS val)`,
            readingsKun: sql`(SELECT coalesce(array_agg(DISTINCT val), '{}') FROM unnest(${kanji.readingsKun}::text[] || ${sqlTextArray(newKun)}) AS val)`,
            jlptLevel: sql`coalesce(${k.jlptLevel ?? null}::integer, ${kanji.jlptLevel})`,
            strokeCount: sql`coalesce(${k.strokeCount ?? null}::integer, ${kanji.strokeCount})`,
          },
        })
        .returning({ id: kanji.id, timesSeen: kanji.timesSeen });
      await ensureReviewTracks(userId, row.id, "kanji");
      const isNew = row.timesSeen === 1;
      counts.kanji.total++;
      if (isNew) counts.kanji.new++;
      else counts.kanji.existing++;
      items.kanji.push({ text: k.character, isNew });
    }

    for (const v of vocabItems) {
      const newMeanings = v.meanings;
      const [row] = await db
        .insert(vocabulary)
        .values({
          userId,
          word: v.word,
          reading: v.reading,
          meanings: newMeanings,
          partOfSpeech: v.partOfSpeech ?? null,
          jlptLevel: v.jlptLevel ?? null,
          sourceImageIds: [sourceImageId],
          timesSeen: 1,
        })
        .onConflictDoUpdate({
          target: [vocabulary.userId, vocabulary.word, vocabulary.reading],
          set: {
            lastSeenAt: new Date(),
            timesSeen: sql`${vocabulary.timesSeen} + 1`,
            sourceImageIds: sql`array_append(${vocabulary.sourceImageIds}, ${sourceImageId}::uuid)`,
            meanings: sql`(SELECT coalesce(array_agg(DISTINCT val), '{}') FROM unnest(${vocabulary.meanings}::text[] || ${sqlTextArray(newMeanings)}) AS val)`,
            partOfSpeech: sql`coalesce(${v.partOfSpeech ?? null}, ${vocabulary.partOfSpeech})`,
            jlptLevel: sql`coalesce(${v.jlptLevel ?? null}::integer, ${vocabulary.jlptLevel})`,
          },
        })
        .returning({ id: vocabulary.id, timesSeen: vocabulary.timesSeen });
      await ensureReviewTracks(userId, row.id, "vocab");
      const isNew = row.timesSeen === 1;
      counts.vocabulary.total++;
      if (isNew) counts.vocabulary.new++;
      else counts.vocabulary.existing++;
      items.vocabulary.push({ text: v.word, reading: v.reading, isNew });
    }

    if (sentenceItems.length > 0) {
      await db.insert(sentences).values(
        sentenceItems.map((s) => ({
          userId,
          japanese: s.japanese,
          english: s.english ?? null,
          source: "extracted" as const,
          sourceImageId,
        }))
      );
      counts.sentences = sentenceItems.length;
    }

    await db
      .update(sourceImages)
      .set({ processed: true })
      .where(eq(sourceImages.id, sourceImageId));

    return NextResponse.json({
      success: true,
      sourceImageId,
      extracted: counts,
      items,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Save extraction error:", error);
    return NextResponse.json({ error: "Failed to save items" }, { status: 500 });
  }
}
