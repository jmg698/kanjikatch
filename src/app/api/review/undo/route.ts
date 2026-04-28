import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { db, reviewTracks, reviewHistory, reviewSessions, userStats } from "@/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { calculateLevel, getTodayDateString } from "@/lib/srs";
import { z } from "zod";

const undoSchema = z.object({
  sessionId: z.string().uuid(),
  historyId: z.string().uuid(),
  trackId: z.string().uuid(),
  xpEarned: z.number().int().min(0).max(200),
  priorTrackState: z.object({
    intervalDays: z.number().int().min(0),
    easeFactor: z.string(),
    reviewCount: z.number().int().min(0),
    timesCorrect: z.number().int().min(0),
    confidenceLevel: z.enum(["new", "learning", "reviewing", "known"]),
    nextReviewAt: z.string().nullable(),
    lastReviewedAt: z.string().nullable(),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = undoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { sessionId, historyId, trackId, xpEarned, priorTrackState } = parsed.data;

    // Verify the history row exists, belongs to this user/session, and is the latest entry.
    const [history] = await db
      .select()
      .from(reviewHistory)
      .where(
        and(
          eq(reviewHistory.id, historyId),
          eq(reviewHistory.userId, userId),
          eq(reviewHistory.sessionId, sessionId),
        ),
      );

    if (!history) {
      return NextResponse.json({ error: "History entry not found" }, { status: 404 });
    }

    const [latest] = await db
      .select({ id: reviewHistory.id })
      .from(reviewHistory)
      .where(and(eq(reviewHistory.userId, userId), eq(reviewHistory.sessionId, sessionId)))
      .orderBy(desc(reviewHistory.reviewedAt))
      .limit(1);

    if (!latest || latest.id !== historyId) {
      return NextResponse.json(
        { error: "Only the most recent submission can be undone" },
        { status: 409 },
      );
    }

    const wasCorrect = history.wasCorrect;

    // 1. Restore the track's prior SRS state
    await db
      .update(reviewTracks)
      .set({
        intervalDays: priorTrackState.intervalDays,
        easeFactor: priorTrackState.easeFactor,
        reviewCount: priorTrackState.reviewCount,
        timesCorrect: priorTrackState.timesCorrect,
        confidenceLevel: priorTrackState.confidenceLevel,
        nextReviewAt: priorTrackState.nextReviewAt ? new Date(priorTrackState.nextReviewAt) : null,
        lastReviewedAt: priorTrackState.lastReviewedAt ? new Date(priorTrackState.lastReviewedAt) : null,
      })
      .where(and(eq(reviewTracks.id, trackId), eq(reviewTracks.userId, userId)));

    // 2. Delete the history entry
    await db.delete(reviewHistory).where(eq(reviewHistory.id, historyId));

    // 3. Reverse session counters and XP
    await db
      .update(reviewSessions)
      .set({
        itemsReviewed: sql`GREATEST(${reviewSessions.itemsReviewed} - 1, 0)`,
        itemsCorrect: wasCorrect
          ? sql`GREATEST(${reviewSessions.itemsCorrect} - 1, 0)`
          : reviewSessions.itemsCorrect,
        xpEarned: sql`GREATEST(${reviewSessions.xpEarned} - ${xpEarned}, 0)`,
      })
      .where(and(eq(reviewSessions.id, sessionId), eq(reviewSessions.userId, userId)));

    // 4. Reverse user stats
    const [stats] = await db.select().from(userStats).where(eq(userStats.userId, userId));
    if (stats) {
      const todayStr = getTodayDateString();
      const newXp = Math.max(0, stats.xp - xpEarned);
      const { level } = calculateLevel(newXp);
      const dailyMatchesToday = stats.dailyReviewsDate === todayStr;

      await db
        .update(userStats)
        .set({
          totalReviews: Math.max(0, stats.totalReviews - 1),
          totalCorrect: Math.max(0, stats.totalCorrect - (wasCorrect ? 1 : 0)),
          xp: newXp,
          level,
          dailyReviewsToday: dailyMatchesToday
            ? Math.max(0, stats.dailyReviewsToday - 1)
            : stats.dailyReviewsToday,
        })
        .where(eq(userStats.userId, userId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Review undo error:", error);
    return NextResponse.json({ error: "Failed to undo review" }, { status: 500 });
  }
}
