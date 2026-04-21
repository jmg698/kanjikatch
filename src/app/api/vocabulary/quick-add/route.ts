import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { db, vocabulary } from "@/db";
import { eq, and } from "drizzle-orm";
import { ensureReviewTracks } from "@/lib/track-queries";
import { enrichVocabulary } from "@/lib/enrichment";
import { z } from "zod";

/**
 * Quick-add flow — the user tapped a word in an In-the-Wild sentence and
 * wants to save it to their vocabulary.
 *
 * Input shape: anything the client happens to know about the word. The AI
 * wild-sentence may or may not have produced a reading/meaning. We always
 * run the word back through the enrichment service (Haiku + sentence
 * context) server-side so the stored row has a real dictionary entry and
 * not a placeholder.
 *
 * Failure policy (Option B): if enrichment fails, we still save the row
 * with the best data we have and set `needsEnrichment: true`. A background
 * retry pass can fill in the gaps later, so the user is never blocked on
 * an AI failure.
 */
const quickAddSchema = z.object({
  word: z.string().min(1).max(100),
  reading: z.string().max(100).optional(),
  hintMeaning: z.string().max(200).optional(),
  sentenceJapanese: z.string().max(1000).optional(),
  sentenceEnglish: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = quickAddSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { word, reading: hintReading, hintMeaning, sentenceJapanese, sentenceEnglish } = parsed.data;

    // Attempt enrichment before touching the DB so we can de-dupe against the
    // canonical reading, not a stale hint reading. If the enrichment fails we
    // fall back to whatever the client gave us.
    let enrichedReading: string | null = null;
    let enrichedMeanings: string[] = [];
    let enrichedPartOfSpeech: string | null = null;
    let enrichedJlptLevel: number | null = null;
    let enrichmentSucceeded = false;
    let enrichmentError: string | null = null;

    try {
      const enriched = await enrichVocabulary({
        word,
        reading: hintReading ?? null,
        hintMeaning: hintMeaning ?? null,
        sentenceJapanese: sentenceJapanese ?? null,
        sentenceEnglish: sentenceEnglish ?? null,
      });
      enrichedReading = enriched.reading;
      enrichedMeanings = enriched.meanings;
      enrichedPartOfSpeech = enriched.partOfSpeech;
      enrichedJlptLevel = enriched.jlptLevel;
      enrichmentSucceeded = true;
    } catch (e) {
      enrichmentError = e instanceof Error ? e.message : "Unknown enrichment error";
      Sentry.captureException(e, { tags: { route: "quick-add", stage: "enrichment" } });
    }

    // Reading fallback: prefer canonical enriched reading → client hint → word
    // itself (last resort so the NOT NULL column is satisfied).
    const finalReading = enrichedReading ?? hintReading ?? word;
    const finalMeanings = enrichmentSucceeded
      ? enrichedMeanings
      : hintMeaning
        ? [hintMeaning]
        : [];

    // De-dupe against the resolved reading — if we just normalized a hint
    // reading and the user already has a row under the canonical reading,
    // that's a duplicate.
    const existing = await db
      .select()
      .from(vocabulary)
      .where(
        and(
          eq(vocabulary.userId, userId),
          eq(vocabulary.word, word),
          eq(vocabulary.reading, finalReading)
        )
      );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Already in your library", existing: existing[0] },
        { status: 409 }
      );
    }

    const [inserted] = await db
      .insert(vocabulary)
      .values({
        userId,
        word,
        reading: finalReading,
        meanings: finalMeanings,
        partOfSpeech: enrichedPartOfSpeech,
        jlptLevel: enrichedJlptLevel,
        needsEnrichment: !enrichmentSucceeded,
        enrichmentAttempts: 1,
        lastEnrichmentAttemptAt: new Date(),
        enrichmentSourceSentence: sentenceJapanese ?? null,
      })
      .returning();

    await ensureReviewTracks(userId, inserted.id, "vocab");

    return NextResponse.json(
      {
        vocabulary: inserted,
        enrichment: {
          succeeded: enrichmentSucceeded,
          error: enrichmentError,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    Sentry.captureException(error);
    console.error("Quick add error:", error);
    return NextResponse.json({ error: "Failed to add vocabulary" }, { status: 500 });
  }
}
