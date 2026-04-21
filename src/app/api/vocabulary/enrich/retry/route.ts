import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db, vocabulary } from "@/db";
import { enrichVocabulary } from "@/lib/enrichment";

/**
 * Retry enrichment for vocabulary rows that were saved without a real
 * definition.
 *
 * This is intended to be called by:
 *   (a) a scheduled cron job, authenticated via the `x-cron-secret` header
 *       matching the `CRON_SECRET` env var. When authenticated this way, the
 *       endpoint sweeps pending rows across ALL users.
 *   (b) an authenticated user (no secret), in which case it only retries
 *       their own pending rows — useful to trigger a refresh from a library
 *       UI button.
 *
 * Rules:
 *  - `needs_enrichment = true` OR legacy rows whose meanings are the old
 *    literal placeholder `"(added from reading)"` are both eligible.
 *  - We cap attempts at MAX_ATTEMPTS so a chronically-bad row can't burn
 *    through credits forever.
 *  - We process at most BATCH_SIZE rows per invocation to stay inside
 *    serverless timeouts.
 *  - Rows that successfully enrich get `needs_enrichment = false` and the
 *    full dictionary payload merged in. Rows that fail again have their
 *    attempt counter bumped.
 */

const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 5;
// Back off between retries so a transient outage doesn't burn every attempt
// on the same minute. 15 minutes between attempts is plenty.
const RETRY_BACKOFF_MS = 15 * 60 * 1000;

const LEGACY_PLACEHOLDER = "(added from reading)";

export async function POST(req: NextRequest) {
  try {
    const cronSecret = req.headers.get("x-cron-secret");
    const isCron =
      !!cronSecret &&
      !!process.env.CRON_SECRET &&
      cronSecret === process.env.CRON_SECRET;

    let scopeUserId: string | null = null;
    if (!isCron) {
      const { userId } = await auth();
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      scopeUserId = userId;
    }

    const now = new Date();
    const backoffCutoff = new Date(now.getTime() - RETRY_BACKOFF_MS);

    const eligibilityCondition = and(
      // Either the explicit flag is set, OR a legacy row still has the old
      // literal placeholder meaning. Cover both so old data gets backfilled.
      or(
        eq(vocabulary.needsEnrichment, true),
        sql`${vocabulary.meanings} = ARRAY[${LEGACY_PLACEHOLDER}]::text[]`
      ),
      lt(vocabulary.enrichmentAttempts, MAX_ATTEMPTS),
      or(
        isNull(vocabulary.lastEnrichmentAttemptAt),
        lt(vocabulary.lastEnrichmentAttemptAt, backoffCutoff)
      ),
      scopeUserId ? eq(vocabulary.userId, scopeUserId) : undefined
    );

    const candidates = await db
      .select()
      .from(vocabulary)
      .where(eligibilityCondition)
      .limit(BATCH_SIZE);

    let succeeded = 0;
    let failed = 0;

    for (const row of candidates) {
      try {
        const enriched = await enrichVocabulary({
          word: row.word,
          reading: row.reading,
          sentenceJapanese: row.enrichmentSourceSentence ?? null,
        });

        await db
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
          .where(eq(vocabulary.id, row.id));

        succeeded++;
      } catch (err) {
        Sentry.captureException(err, {
          tags: { route: "enrich-retry", stage: "enrich" },
          extra: { vocabId: row.id, word: row.word },
        });
        await db
          .update(vocabulary)
          .set({
            enrichmentAttempts: row.enrichmentAttempts + 1,
            lastEnrichmentAttemptAt: new Date(),
          })
          .where(eq(vocabulary.id, row.id));
        failed++;
      }
    }

    return NextResponse.json({
      processed: candidates.length,
      succeeded,
      failed,
      scope: isCron ? "all_users" : "self",
      batchSize: BATCH_SIZE,
      maxAttempts: MAX_ATTEMPTS,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Enrichment retry error:", error);
    return NextResponse.json({ error: "Failed to run enrichment retry" }, { status: 500 });
  }
}
