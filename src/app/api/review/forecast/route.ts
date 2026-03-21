import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { db, reviewTracks } from "@/db";
import { eq, and, gte, lt, isNull, or, lte, sql } from "drizzle-orm";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const forecast: { date: string; kanji: number; vocab: number; total: number }[] = [];

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() + dayOffset);

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      let kanjiCondition;
      let vocabCondition;

      if (dayOffset === 0) {
        kanjiCondition = and(
          eq(reviewTracks.userId, userId),
          eq(reviewTracks.itemType, "kanji"),
          or(lte(reviewTracks.nextReviewAt, dayEnd), isNull(reviewTracks.nextReviewAt)),
        );
        vocabCondition = and(
          eq(reviewTracks.userId, userId),
          eq(reviewTracks.itemType, "vocab"),
          or(lte(reviewTracks.nextReviewAt, dayEnd), isNull(reviewTracks.nextReviewAt)),
        );
      } else {
        kanjiCondition = and(
          eq(reviewTracks.userId, userId),
          eq(reviewTracks.itemType, "kanji"),
          gte(reviewTracks.nextReviewAt, dayStart),
          lt(reviewTracks.nextReviewAt, dayEnd),
        );
        vocabCondition = and(
          eq(reviewTracks.userId, userId),
          eq(reviewTracks.itemType, "vocab"),
          gte(reviewTracks.nextReviewAt, dayStart),
          lt(reviewTracks.nextReviewAt, dayEnd),
        );
      }

      const [kanjiCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(reviewTracks)
        .where(kanjiCondition);

      const [vocabCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(reviewTracks)
        .where(vocabCondition);

      forecast.push({
        date: dayStart.toISOString().slice(0, 10),
        kanji: kanjiCount.count,
        vocab: vocabCount.count,
        total: kanjiCount.count + vocabCount.count,
      });
    }

    return NextResponse.json({ forecast });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Forecast error:", error);
    return NextResponse.json({ error: "Failed to fetch forecast" }, { status: 500 });
  }
}
