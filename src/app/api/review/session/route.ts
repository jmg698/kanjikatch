import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, reviewSessions, userStats } from "@/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getSessionCompletionXp, calculateLevel, updateStreak, getTodayDateString } from "@/lib/srs";

const startSchema = z.object({
  action: z.literal("start"),
  sessionType: z.enum(["kanji", "vocab", "mixed"]),
});

const completeSchema = z.object({
  action: z.literal("complete"),
  sessionId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Start a new session
    if (body.action === "start") {
      const parsed = startSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
      }

      const [session] = await db
        .insert(reviewSessions)
        .values({
          userId,
          sessionType: parsed.data.sessionType,
        })
        .returning();

      return NextResponse.json({ sessionId: session.id, startedAt: session.startedAt });
    }

    // Complete a session
    if (body.action === "complete") {
      const parsed = completeSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
      }

      const now = new Date();

      const [session] = await db
        .update(reviewSessions)
        .set({ completedAt: now })
        .where(eq(reviewSessions.id, parsed.data.sessionId))
        .returning();

      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      // Award session completion XP
      const completionXp = getSessionCompletionXp();
      const [stats] = await db.select().from(userStats).where(eq(userStats.userId, userId));

      if (stats) {
        const todayStr = getTodayDateString();
        const streakUpdate = updateStreak(stats.lastReviewDate, stats.currentStreak, stats.longestStreak, todayStr);
        const newXp = stats.xp + completionXp;
        const { level } = calculateLevel(newXp);

        await db
          .update(userStats)
          .set({
            xp: newXp,
            level,
            currentStreak: streakUpdate.currentStreak,
            longestStreak: streakUpdate.longestStreak,
            lastReviewDate: todayStr,
          })
          .where(eq(userStats.userId, userId));
      }

      await db
        .update(reviewSessions)
        .set({ xpEarned: sql`${reviewSessions.xpEarned} + ${completionXp}` })
        .where(eq(reviewSessions.id, session.id));

      const durationMs = now.getTime() - session.startedAt.getTime();

      return NextResponse.json({
        summary: {
          sessionId: session.id,
          itemsReviewed: session.itemsReviewed,
          itemsCorrect: session.itemsCorrect,
          accuracy: session.itemsReviewed > 0
            ? Math.round((session.itemsCorrect / session.itemsReviewed) * 100)
            : 0,
          xpEarned: session.xpEarned + completionXp,
          durationMs,
          completedAt: now.toISOString(),
        },
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Session error:", error);
    return NextResponse.json({ error: "Failed to process session" }, { status: 500 });
  }
}
