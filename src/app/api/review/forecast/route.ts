import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, kanji, vocabulary } from "@/db";
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
        // Today: items already overdue + items due today
        kanjiCondition = and(
          eq(kanji.userId, userId),
          or(lte(kanji.nextReviewAt, dayEnd), isNull(kanji.nextReviewAt)),
        );
        vocabCondition = and(
          eq(vocabulary.userId, userId),
          or(lte(vocabulary.nextReviewAt, dayEnd), isNull(vocabulary.nextReviewAt)),
        );
      } else {
        // Future days: items due in that window
        kanjiCondition = and(
          eq(kanji.userId, userId),
          gte(kanji.nextReviewAt, dayStart),
          lt(kanji.nextReviewAt, dayEnd),
        );
        vocabCondition = and(
          eq(vocabulary.userId, userId),
          gte(vocabulary.nextReviewAt, dayStart),
          lt(vocabulary.nextReviewAt, dayEnd),
        );
      }

      const [kanjiCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(kanji)
        .where(kanjiCondition);

      const [vocabCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(vocabulary)
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
    console.error("Forecast error:", error);
    return NextResponse.json({ error: "Failed to fetch forecast" }, { status: 500 });
  }
}
