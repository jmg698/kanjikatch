import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { db, sourceImages, kanji, vocabulary, sentences, users } from "@/db";
import { uploadSchema } from "@/lib/validations";
import { extractFromImage } from "@/lib/ai";
import { checkExtractionRateLimit } from "@/lib/rate-limit";
import { ensureReviewTracks } from "@/lib/track-queries";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed, remaining } = await checkExtractionRateLimit(userId);
    if (!allowed) {
      return NextResponse.json(
        { error: "Weekly extraction limit reached (200 per week). Please try again later." },
        { status: 429 }
      );
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
    const counts = {
      kanji: { total: 0, new: 0, existing: 0 },
      vocabulary: { total: 0, new: 0, existing: 0 },
      sentences: 0,
    };

    try {
      extraction = await extractFromImage(imageUrl);

      await db
        .update(sourceImages)
        .set({ extractionRaw: extraction })
        .where(eq(sourceImages.id, sourceImage.id));

      for (const k of extraction.kanji) {
        const [row] = await db
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
          })
          .returning({ id: kanji.id, timesSeen: kanji.timesSeen });
        await ensureReviewTracks(userId, row.id, "kanji");
        counts.kanji.total++;
        if (row.timesSeen === 1) counts.kanji.new++;
        else counts.kanji.existing++;
      }

      for (const v of extraction.vocabulary) {
        const [row] = await db
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
          })
          .returning({ id: vocabulary.id, timesSeen: vocabulary.timesSeen });
        await ensureReviewTracks(userId, row.id, "vocab");
        counts.vocabulary.total++;
        if (row.timesSeen === 1) counts.vocabulary.new++;
        else counts.vocabulary.existing++;
      }

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
        counts.sentences = extraction.sentences.length;
      }

      await db
        .update(sourceImages)
        .set({ processed: true })
        .where(eq(sourceImages.id, sourceImage.id));

      return NextResponse.json({
        success: true,
        sourceImageId: sourceImage.id,
        extracted: counts,
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
    Sentry.captureException(error);
    console.error("Extraction error:", error);
    const rawMessage = error instanceof Error ? error.message : String(error);
    const isOverloaded =
      typeof rawMessage === "string" &&
      (rawMessage.includes("overloaded_error") || rawMessage.includes("Overloaded") || rawMessage.startsWith("529 "));

    const userMessage = isOverloaded
      ? "Our AI is temporarily overloaded. Please try again in a minute."
      : "Failed to process image";

    return NextResponse.json({ error: userMessage }, { status: isOverloaded ? 503 : 500 });
  }
}
