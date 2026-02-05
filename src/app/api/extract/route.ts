import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, sourceImages, kanji, vocabulary, sentences, users } from "@/db";
import { uploadSchema } from "@/lib/validations";
import { extractFromImage } from "@/lib/ai";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = uploadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { imageUrl, fileName } = parsed.data;

    // Ensure user exists in our database
    const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (existingUser.length === 0) {
      await db.insert(users).values({
        id: userId,
        email: "unknown@example.com", // Will be updated by webhook
      });
    }

    // Create source image record
    const [sourceImage] = await db
      .insert(sourceImages)
      .values({
        userId,
        imageUrl,
        processed: false,
      })
      .returning();

    let extraction;
    let extractedCounts = { kanji: 0, vocabulary: 0, sentences: 0 };

    try {
      // Extract content using AI
      extraction = await extractFromImage(imageUrl);

      // Store raw extraction for debugging
      await db
        .update(sourceImages)
        .set({ extractionRaw: extraction })
        .where(eq(sourceImages.id, sourceImage.id));

      // Process kanji with frequency tracking (upsert)
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
            sourceImageIds: [sourceImage.id],
            timesSeen: 1,
          })
          .onConflictDoUpdate({
            target: [kanji.userId, kanji.character],
            set: {
              lastSeenAt: new Date(),
              timesSeen: sql`${kanji.timesSeen} + 1`,
              sourceImageIds: sql`array_append(${kanji.sourceImageIds}, ${sourceImage.id}::uuid)`,
            },
          });
        extractedCounts.kanji++;
      }

      // Process vocabulary with frequency tracking (upsert)
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
            sourceImageIds: [sourceImage.id],
            timesSeen: 1,
          })
          .onConflictDoUpdate({
            target: [vocabulary.userId, vocabulary.word, vocabulary.reading],
            set: {
              lastSeenAt: new Date(),
              timesSeen: sql`${vocabulary.timesSeen} + 1`,
              sourceImageIds: sql`array_append(${vocabulary.sourceImageIds}, ${sourceImage.id}::uuid)`,
            },
          });
        extractedCounts.vocabulary++;
      }

      // Process sentences (no deduplication for sentences)
      if (extraction.sentences.length > 0) {
        await db.insert(sentences).values(
          extraction.sentences.map((s) => ({
            userId,
            japanese: s.japanese,
            english: s.english ?? null,
            source: "extracted" as const,
            sourceImageId: sourceImage.id,
          }))
        );
        extractedCounts.sentences = extraction.sentences.length;
      }

      // Mark source image as processed
      await db
        .update(sourceImages)
        .set({ processed: true })
        .where(eq(sourceImages.id, sourceImage.id));

      return NextResponse.json({
        success: true,
        sourceImageId: sourceImage.id,
        extracted: extractedCounts,
      });
    } catch (extractionError) {
      // Store error message in source image
      const errorMessage =
        extractionError instanceof Error
          ? extractionError.message
          : "Unknown extraction error";

      await db
        .update(sourceImages)
        .set({
          errorMessage,
          processed: true, // Mark as processed even with error
        })
        .where(eq(sourceImages.id, sourceImage.id));

      throw extractionError;
    }
  } catch (error) {
    console.error("Extraction error:", error);
    return NextResponse.json(
      {
        error: "Failed to process image",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
