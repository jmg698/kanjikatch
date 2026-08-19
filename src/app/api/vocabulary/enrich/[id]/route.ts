import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, vocabulary } from "@/db";
import { enrichVocabulary, ENRICHMENT_MAX_ATTEMPTS } from "@/lib/enrichment";
import { assertCostProtection, getClientIp, hashIp } from "@/lib/cost-protection";

/**
 * Repair one vocabulary row's definition, right now.
 *
 * The batch sweep at ../retry is the background path: it walks every pending
 * row across all users on a schedule and backs off 15 minutes between attempts.
 * This route is the foreground path, fired when a user sets a card aside with
 * reason 'bad_data' — they've told us the definition is wrong and are waiting
 * on the fix, so we skip the backoff and enrich this row immediately.
 *
 * The MAX_ATTEMPTS cap still applies: a row that can't be enriched after
 * several tries is a data problem the model won't solve on the next call, and
 * the answer there is a manual edit, not more spend.
 *
 * Does NOT put the card back into rotation on success. The user parked it
 * deliberately; the library shows them the repaired definition and lets them
 * decide. See api/items/triage.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
    }

    const ipHash = hashIp(getClientIp(req));
    const guard = await assertCostProtection({ userId, ipHash, endpoint: "enrich" });
    if (!guard.allowed) {
      return NextResponse.json(
        { error: guard.message, code: guard.reason },
        { status: guard.status, headers: { "Retry-After": String(guard.retryAfterSec) } },
      );
    }

    const [row] = await db
      .select()
      .from(vocabulary)
      .where(and(eq(vocabulary.id, id), eq(vocabulary.userId, userId)))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (row.enrichmentAttempts >= ENRICHMENT_MAX_ATTEMPTS) {
      return NextResponse.json(
        {
          error:
            "We've tried to look this one up several times without luck. Editing it by hand is the way to fix it.",
          code: "max_attempts",
          attempts: row.enrichmentAttempts,
        },
        { status: 409 },
      );
    }

    try {
      const enriched = await enrichVocabulary(
        {
          word: row.word,
          reading: row.reading,
          sentenceJapanese: row.enrichmentSourceSentence ?? null,
        },
        { userId, ipHash },
      );

      const [updated] = await db
        .update(vocabulary)
        .set({
          reading: enriched.reading,
          meanings: enriched.meanings,
          partOfSpeech: enriched.partOfSpeech ?? row.partOfSpeech,
          jlptLevel: enriched.jlptLevel ?? row.jlptLevel,
          needsEnrichment: false,
          enrichmentAttempts: row.enrichmentAttempts + 1,
          lastEnrichmentAttemptAt: new Date(),
        })
        .where(eq(vocabulary.id, row.id))
        .returning({
          id: vocabulary.id,
          word: vocabulary.word,
          reading: vocabulary.reading,
          meanings: vocabulary.meanings,
          partOfSpeech: vocabulary.partOfSpeech,
          jlptLevel: vocabulary.jlptLevel,
        });

      return NextResponse.json({ repaired: true, item: updated });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { route: "enrich-one", stage: "enrich" },
        extra: { vocabId: row.id, word: row.word },
      });

      const attempts = row.enrichmentAttempts + 1;
      await db
        .update(vocabulary)
        .set({ enrichmentAttempts: attempts, lastEnrichmentAttemptAt: new Date() })
        .where(eq(vocabulary.id, row.id));

      return NextResponse.json(
        {
          repaired: false,
          error: "Couldn't look that word up just now. We'll try again in the background.",
          attempts,
          attemptsRemaining: Math.max(ENRICHMENT_MAX_ATTEMPTS - attempts, 0),
        },
        { status: 502 },
      );
    }
  } catch (error) {
    Sentry.captureException(error);
    console.error("Single-item enrichment error:", error);
    return NextResponse.json({ error: "Failed to repair card" }, { status: 500 });
  }
}
