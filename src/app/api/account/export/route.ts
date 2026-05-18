import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { getCurrentUserId } from "@/lib/auth";
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
  userReports,
} from "@/db";

// Returns every row this user owns as a single JSON document. The export
// intentionally excludes api_usage_events — those are operational cost-tracking
// records, not user content, and they survive account deletion in anonymized
// form. See the Privacy Policy for details.
export async function GET() {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [
      [profile],
      sourceImageRows,
      kanjiRows,
      vocabRows,
      sentenceRows,
      sessionRows,
      historyRows,
      statsRows,
      generatedRows,
      reviewTrackRows,
      contentRows,
      reportRows,
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
      db.select().from(userReports).where(eq(userReports.userId, userId)),
    ]);

    // generated_sentence_targets has no userId column — fan out from the
    // generated sentence ids we already loaded.
    const generatedIds = generatedRows.map((row) => row.id);
    const generatedTargetRows = generatedIds.length
      ? await db
          .select()
          .from(generatedSentenceTargets)
          .where(inArray(generatedSentenceTargets.sentenceId, generatedIds))
      : [];

    // Deliberately omit Stripe identifiers, comped-tier metadata, and other
    // internal billing fields — those are not user content.
    const safeProfile = profile
      ? {
          id: profile.id,
          email: profile.email,
          subscriptionTier: profile.subscriptionTier,
          subscriptionStatus: profile.subscriptionStatus,
          currentPeriodEnd: profile.currentPeriodEnd,
          trialEnd: profile.trialEnd,
          cancelAtPeriodEnd: profile.cancelAtPeriodEnd,
          createdAt: profile.createdAt,
        }
      : null;

    const payload = {
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      userId,
      profile: safeProfile,
      sourceImages: sourceImageRows,
      kanji: kanjiRows,
      vocabulary: vocabRows,
      sentences: sentenceRows,
      reviewSessions: sessionRows,
      reviewHistory: historyRows,
      userStats: statsRows,
      generatedSentences: generatedRows,
      generatedSentenceTargets: generatedTargetRows,
      reviewTracks: reviewTrackRows,
      contentItems: contentRows,
      userReports: reportRows,
    };

    const filename = `kanjikatch-export-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Failed to build export" },
      { status: 500 },
    );
  }
}
