import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, kanji, vocabulary, reviewHistory, reviewSessions, userStats } from "@/db";
import { eq, and, sql } from "drizzle-orm";
import { processReview, calculateXp, calculateLevel, updateStreak, getTodayDateString, type Grade, type SrsState } from "@/lib/srs";
import { z } from "zod";

const submitSchema = z.object({
  sessionId: z.string().uuid(),
  itemId: z.string().uuid(),
  itemType: z.enum(["kanji", "vocab"]),
  questionType: z.enum(["meaning", "reading"]),
  grade: z.enum(["again", "hard", "good", "easy"]),
  responseTimeMs: z.number().int().positive().optional(),
  consecutiveCorrect: z.number().int().min(0).default(0),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { sessionId, itemId, itemType, questionType, grade, responseTimeMs, consecutiveCorrect } = parsed.data;
    const wasCorrect = grade !== "again";
    const now = new Date();
    const todayStr = getTodayDateString();

    // 1. Fetch current SRS state
    let currentState: SrsState;
    if (itemType === "kanji") {
      const [item] = await db.select().from(kanji).where(and(eq(kanji.id, itemId), eq(kanji.userId, userId)));
      if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
      currentState = {
        intervalDays: item.intervalDays,
        easeFactor: parseFloat(item.easeFactor),
        reviewCount: item.reviewCount,
        timesCorrect: item.timesCorrect,
        confidenceLevel: item.confidenceLevel as SrsState["confidenceLevel"],
      };
    } else {
      const [item] = await db.select().from(vocabulary).where(and(eq(vocabulary.id, itemId), eq(vocabulary.userId, userId)));
      if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
      currentState = {
        intervalDays: item.intervalDays,
        easeFactor: parseFloat(item.easeFactor),
        reviewCount: item.reviewCount,
        timesCorrect: item.timesCorrect,
        confidenceLevel: item.confidenceLevel as SrsState["confidenceLevel"],
      };
    }

    // 2. Calculate SRS update
    const srsUpdate = processReview(grade as Grade, currentState, now);

    // 3. Update item SRS fields
    const updateFields = {
      intervalDays: srsUpdate.intervalDays,
      easeFactor: srsUpdate.easeFactor.toFixed(2),
      reviewCount: srsUpdate.reviewCount,
      timesCorrect: srsUpdate.timesCorrect,
      confidenceLevel: srsUpdate.confidenceLevel,
      nextReviewAt: srsUpdate.nextReviewAt,
      lastReviewedAt: srsUpdate.lastReviewedAt,
    };

    if (itemType === "kanji") {
      await db.update(kanji).set(updateFields).where(eq(kanji.id, itemId));
    } else {
      await db.update(vocabulary).set(updateFields).where(eq(vocabulary.id, itemId));
    }

    // 4. Record in review history
    await db.insert(reviewHistory).values({
      userId,
      sessionId,
      itemType,
      itemId,
      questionType,
      wasCorrect,
      quality: { again: 1, hard: 3, good: 4, easy: 5 }[grade],
      responseTimeMs: responseTimeMs ?? null,
      reviewedAt: now,
    });

    // 5. Update session counters
    await db
      .update(reviewSessions)
      .set({
        itemsReviewed: sql`${reviewSessions.itemsReviewed} + 1`,
        itemsCorrect: wasCorrect ? sql`${reviewSessions.itemsCorrect} + 1` : reviewSessions.itemsCorrect,
      })
      .where(eq(reviewSessions.id, sessionId));

    // 6. Calculate XP earned
    const xpEarned = calculateXp(grade as Grade, consecutiveCorrect);

    // 7. Update user stats (upsert)
    const [existingStats] = await db.select().from(userStats).where(eq(userStats.userId, userId));

    if (existingStats) {
      const streakUpdate = updateStreak(
        existingStats.lastReviewDate,
        existingStats.currentStreak,
        existingStats.longestStreak,
        todayStr,
      );

      const newXp = existingStats.xp + xpEarned;
      const { level } = calculateLevel(newXp);
      const isNewDay = existingStats.dailyReviewsDate !== todayStr;

      await db
        .update(userStats)
        .set({
          totalReviews: existingStats.totalReviews + 1,
          totalCorrect: existingStats.totalCorrect + (wasCorrect ? 1 : 0),
          xp: newXp,
          level,
          currentStreak: streakUpdate.currentStreak,
          longestStreak: streakUpdate.longestStreak,
          lastReviewDate: todayStr,
          dailyReviewsToday: isNewDay ? 1 : existingStats.dailyReviewsToday + 1,
          dailyReviewsDate: todayStr,
        })
        .where(eq(userStats.userId, userId));
    } else {
      const { level } = calculateLevel(xpEarned);
      await db.insert(userStats).values({
        userId,
        totalReviews: 1,
        totalCorrect: wasCorrect ? 1 : 0,
        xp: xpEarned,
        level,
        currentStreak: 1,
        longestStreak: 1,
        lastReviewDate: todayStr,
        dailyReviewsToday: 1,
        dailyReviewsDate: todayStr,
      });
    }

    // Update session XP
    await db
      .update(reviewSessions)
      .set({ xpEarned: sql`${reviewSessions.xpEarned} + ${xpEarned}` })
      .where(eq(reviewSessions.id, sessionId));

    return NextResponse.json({
      success: true,
      xpEarned,
      wasCorrect,
      srsUpdate: {
        intervalDays: srsUpdate.intervalDays,
        confidenceLevel: srsUpdate.confidenceLevel,
        nextReviewAt: srsUpdate.nextReviewAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Review submit error:", error);
    return NextResponse.json(
      { error: "Failed to submit review" },
      { status: 500 },
    );
  }
}
