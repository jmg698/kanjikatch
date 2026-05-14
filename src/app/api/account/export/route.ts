import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  users,
  sourceImages,
  kanji,
  vocabulary,
  sentences,
  reviewSessions,
  reviewHistory,
  userStats,
  generatedSentences,
  generatedSentenceTargets,
  reviewTracks,
  contentItems,
} from "@/db";

// Data export endpoint. Returns the full set of tables that reference the
// caller's userId as a single JSON document, suitable for GDPR / CCPA access
// requests and for users who just want a backup.
//
// Intentionally not zipped — Neon + small users keep the payload well within
// what a browser can stream. If the dataset grows past a few MB for a typical
// user, swap to per-table streaming or a background-generated zip.
//
// Excludes: api_usage_events (kept anonymized for abuse audit per Privacy
// Policy §8), Stripe billing metadata stored on the user row (provided in
// summary form only — full invoices live in Stripe and can be exported there).
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [
      [userRow],
      sourceImageRows,
      kanjiRows,
      vocabularyRows,
      sentenceRows,
      reviewSessionRows,
      reviewHistoryRows,
      userStatsRows,
      generatedSentenceRows,
      reviewTrackRows,
      contentItemRows,
    ] = await Promise.all([
      db.select().from(users).where(eq(users.id, userId)).limit(1),
      db.select().from(sourceImages).where(eq(sourceImages.userId, userId)),
      db.select().from(kanji).where(eq(kanji.userId, userId)),
      db.select().from(vocabulary).where(eq(vocabulary.userId, userId)),
      db.select().from(sentences).where(eq(sentences.userId, userId)),
      db.select().from(reviewSessions).where(eq(reviewSessions.userId, userId)),
      db.select().from(reviewHistory).where(eq(reviewHistory.userId, userId)),
      db.select().from(userStats).where(eq(userStats.userId, userId)),
      db.select().from(generatedSentences).where(eq(generatedSentences.userId, userId)),
      db.select().from(reviewTracks).where(eq(reviewTracks.userId, userId)),
      db.select().from(contentItems).where(eq(contentItems.userId, userId)),
    ]);

    // generated_sentence_targets is keyed by sentenceId, not userId — fetch
    // it via the user's generated sentence IDs.
    const generatedSentenceIds = generatedSentenceRows.map((s) => s.id);
    const targets = generatedSentenceIds.length > 0
      ? await db
          .select()
          .from(generatedSentenceTargets)
          .where(inArray(generatedSentenceTargets.sentenceId, generatedSentenceIds))
      : [];

    // Redact internal billing identifiers — useful for the user to know what
    // we hold, but the Stripe IDs themselves aren't user-meaningful.
    const userExport = userRow
      ? {
          id: userRow.id,
          email: userRow.email,
          createdAt: userRow.createdAt,
          updatedAt: userRow.updatedAt,
          subscriptionTier: userRow.subscriptionTier,
          subscriptionStatus: userRow.subscriptionStatus,
          currentPeriodEnd: userRow.currentPeriodEnd,
          trialEnd: userRow.trialEnd,
          cancelAtPeriodEnd: userRow.cancelAtPeriodEnd,
          extractionsUsedThisPeriod: userRow.extractionsUsedThisPeriod,
          extractionsPeriodStart: userRow.extractionsPeriodStart,
          starterExtractionsUsed: userRow.starterExtractionsUsed,
        }
      : null;

    const payload = {
      meta: {
        exportedAt: new Date().toISOString(),
        format: "kanjikatch-export-v1",
        notes: [
          "This file is a snapshot of all study data tied to your account.",
          "Billing/invoice records live in Stripe and can be exported there.",
          "Anonymized API usage logs are not included (see Privacy Policy §8).",
        ],
      },
      user: userExport,
      userStats: userStatsRows,
      sourceImages: sourceImageRows,
      kanji: kanjiRows,
      vocabulary: vocabularyRows,
      sentences: sentenceRows,
      reviewSessions: reviewSessionRows,
      reviewHistory: reviewHistoryRows,
      reviewTracks: reviewTrackRows,
      generatedSentences: generatedSentenceRows,
      generatedSentenceTargets: targets,
      contentItems: contentItemRows,
    };

    const json = JSON.stringify(payload, null, 2);
    const filename = `kanjikatch-export-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error("[account/export] failed", err);
    return NextResponse.json(
      { error: "Failed to export account data." },
      { status: 500 },
    );
  }
}
