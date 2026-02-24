import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, sourceImages, kanji, vocabulary, sentences, users } from "@/db";
import { textInputSchema } from "@/lib/validations";
import { extractFromText } from "@/lib/ai";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = textInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { text } = parsed.data;

    const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (existingUser.length === 0) {
      await db.insert(users).values({
        id: userId,
        email: "unknown@example.com",
      });
    }

    const [source] = await db
      .insert(sourceImages)
      .values({
        userId,
        sourceText: text,
        processed: false,
      })
      .returning();

    let extractedCounts = { kanji: 0, vocabulary: 0, sentences: 0 };

    try {
      const extraction = await extractFromText(text);

      await db
        .update(sourceImages)
        .set({ extractionRaw: extraction })
        .where(eq(sourceImages.id, source.id));

      for (const k of extraction.kanji) {
        await db
          .insert(kanji)
          .values({
            userId,
            character: k.character,
            meanings: k.meanings,
            readingsOn: k.readingsOn ?? [],
            readingsKun: k.readingsKun ?? [],
            jlptLevel: k.jlptLevel ?? null,
            strokeCount: k.strokeCount ?? null,
            sourceImageIds: [source.id],
            timesSeen: 1,
          })
          .onConflictDoUpdate({
            target: [kanji.userId, kanji.character],
            set: {
              lastSeenAt: new Date(),
              timesSeen: sql`${kanji.timesSeen} + 1`,
              sourceImageIds: sql`array_append(${kanji.sourceImageIds}, ${source.id}::uuid)`,
            },
          });
        extractedCounts.kanji++;
      }

      for (const v of extraction.vocabulary) {
        await db
          .insert(vocabulary)
          .values({
            userId,
            word: v.word,
            reading: v.reading,
            meanings: v.meanings,
            partOfSpeech: v.partOfSpeech ?? null,
            jlptLevel: v.jlptLevel ?? null,
            sourceImageIds: [source.id],
            timesSeen: 1,
          })
          .onConflictDoUpdate({
            target: [vocabulary.userId, vocabulary.word, vocabulary.reading],
            set: {
              lastSeenAt: new Date(),
              timesSeen: sql`${vocabulary.timesSeen} + 1`,
              sourceImageIds: sql`array_append(${vocabulary.sourceImageIds}, ${source.id}::uuid)`,
            },
          });
        extractedCounts.vocabulary++;
      }

      if (extraction.sentences.length > 0) {
        await db.insert(sentences).values(
          extraction.sentences.map((s) => ({
            userId,
            japanese: s.japanese,
            english: s.english ?? null,
            source: "extracted" as const,
            sourceImageId: source.id,
          }))
        );
        extractedCounts.sentences = extraction.sentences.length;
      }

      await db
        .update(sourceImages)
        .set({ processed: true })
        .where(eq(sourceImages.id, source.id));

      return NextResponse.json({
        success: true,
        sourceId: source.id,
        extracted: extractedCounts,
      });
    } catch (extractionError) {
      const errorMessage =
        extractionError instanceof Error
          ? extractionError.message
          : "Unknown extraction error";

      await db
        .update(sourceImages)
        .set({
          errorMessage,
          processed: true,
        })
        .where(eq(sourceImages.id, source.id));

      throw extractionError;
    }
  } catch (error) {
    console.error("Text extraction error:", error);
    return NextResponse.json(
      {
        error: "Failed to process text",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
