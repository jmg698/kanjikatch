import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, kanji, vocabulary, userStats, reviewSessions } from "@/db";
import { eq, and, or, lte, isNull, desc, sql } from "drizzle-orm";
import { calculateLevel, getLevelTitle, getTodayDateString } from "@/lib/srs";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const todayStr = getTodayDateString();

    // Get user stats
    const [stats] = await db.select().from(userStats).where(eq(userStats.userId, userId));

    // Due counts
    const [kanjiDue] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(kanji)
      .where(and(eq(kanji.userId, userId), or(lte(kanji.nextReviewAt, now), isNull(kanji.nextReviewAt))));

    const [vocabDue] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vocabulary)
      .where(and(eq(vocabulary.userId, userId), or(lte(vocabulary.nextReviewAt, now), isNull(vocabulary.nextReviewAt))));

    // Total counts
    const [kanjiTotal] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(kanji)
      .where(eq(kanji.userId, userId));

    const [vocabTotal] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vocabulary)
      .where(eq(vocabulary.userId, userId));

    // Confidence breakdown
    const kanjiConfidence = await db
      .select({
        level: kanji.confidenceLevel,
        count: sql<number>`count(*)::int`,
      })
      .from(kanji)
      .where(eq(kanji.userId, userId))
      .groupBy(kanji.confidenceLevel);

    const vocabConfidence = await db
      .select({
        level: vocabulary.confidenceLevel,
        count: sql<number>`count(*)::int`,
      })
      .from(vocabulary)
      .where(eq(vocabulary.userId, userId))
      .groupBy(vocabulary.confidenceLevel);

    // Recent sessions (last 5)
    const recentSessions = await db
      .select()
      .from(reviewSessions)
      .where(eq(reviewSessions.userId, userId))
      .orderBy(desc(reviewSessions.startedAt))
      .limit(5);

    const xp = stats?.xp ?? 0;
    const levelInfo = calculateLevel(xp);
    const dailyReviewsToday = stats?.dailyReviewsDate === todayStr ? (stats?.dailyReviewsToday ?? 0) : 0;

    return NextResponse.json({
      stats: {
        currentStreak: stats?.currentStreak ?? 0,
        longestStreak: stats?.longestStreak ?? 0,
        totalReviews: stats?.totalReviews ?? 0,
        totalCorrect: stats?.totalCorrect ?? 0,
        accuracy: stats && stats.totalReviews > 0
          ? Math.round((stats.totalCorrect / stats.totalReviews) * 100)
          : 0,
        xp,
        level: levelInfo.level,
        levelTitle: getLevelTitle(levelInfo.level),
        xpInLevel: levelInfo.xpInLevel,
        xpForNext: levelInfo.xpForNext,
        dailyGoal: stats?.dailyGoal ?? 10,
        dailyReviewsToday,
      },
      due: {
        kanji: kanjiDue.count,
        vocab: vocabDue.count,
        total: kanjiDue.count + vocabDue.count,
      },
      totals: {
        kanji: kanjiTotal.count,
        vocab: vocabTotal.count,
      },
      confidence: {
        kanji: Object.fromEntries(kanjiConfidence.map((c) => [c.level, c.count])),
        vocab: Object.fromEntries(vocabConfidence.map((c) => [c.level, c.count])),
      },
      recentSessions: recentSessions.map((s) => ({
        id: s.id,
        sessionType: s.sessionType,
        itemsReviewed: s.itemsReviewed,
        itemsCorrect: s.itemsCorrect,
        xpEarned: s.xpEarned,
        startedAt: s.startedAt.toISOString(),
        completedAt: s.completedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
