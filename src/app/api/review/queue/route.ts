import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { db, kanji, vocabulary, sourceImages, reviewTracks } from "@/db";
import { eq, and, or, lte, isNull, asc, sql, inArray } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "mixed";
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const now = new Date();

    type ReviewItem = {
      id: string;
      trackId: string;
      type: "kanji" | "vocab";
      questionType: "meaning" | "reading";
      prompt: string;
      readings: string[];
      readingsKun?: string[];
      meanings: string[];
      partOfSpeech?: string | null;
      jlptLevel: number | null;
      firstSeenAt: Date;
      timesSeen: number;
      sourceImageIds: string[];
      reviewCount: number;
      confidenceLevel: string;
      intervalDays: number;
      easeFactor: string;
      timesCorrect: number;
      nextReviewAt: Date | null;
    };

    const items: ReviewItem[] = [];
    const seenItemIds = new Set<string>();

    if (type === "kanji" || type === "mixed") {
      const kanjiTracks = await db
        .select({
          trackId: reviewTracks.id,
          trackQuestionType: reviewTracks.questionType,
          trackNextReviewAt: reviewTracks.nextReviewAt,
          trackIntervalDays: reviewTracks.intervalDays,
          trackEaseFactor: reviewTracks.easeFactor,
          trackReviewCount: reviewTracks.reviewCount,
          trackTimesCorrect: reviewTracks.timesCorrect,
          trackConfidenceLevel: reviewTracks.confidenceLevel,
          itemId: kanji.id,
          character: kanji.character,
          readingsOn: kanji.readingsOn,
          readingsKun: kanji.readingsKun,
          meanings: kanji.meanings,
          jlptLevel: kanji.jlptLevel,
          firstSeenAt: kanji.firstSeenAt,
          timesSeen: kanji.timesSeen,
          sourceImageIds: kanji.sourceImageIds,
        })
        .from(reviewTracks)
        .innerJoin(kanji, eq(reviewTracks.itemId, kanji.id))
        .where(
          and(
            eq(reviewTracks.userId, userId),
            eq(reviewTracks.itemType, "kanji"),
            or(
              lte(reviewTracks.nextReviewAt, now),
              isNull(reviewTracks.nextReviewAt),
            ),
          ),
        )
        .orderBy(
          sql`CASE WHEN ${reviewTracks.nextReviewAt} IS NULL THEN 1 ELSE 0 END`,
          asc(reviewTracks.nextReviewAt),
        )
        .limit(type === "mixed" ? limit : limit * 2);

      for (const row of kanjiTracks) {
        if (seenItemIds.has(row.itemId)) continue;
        seenItemIds.add(row.itemId);

        items.push({
          id: row.itemId,
          trackId: row.trackId,
          type: "kanji",
          questionType: row.trackQuestionType as "meaning" | "reading",
          prompt: row.character,
          readings: row.readingsOn,
          readingsKun: row.readingsKun,
          meanings: row.meanings,
          jlptLevel: row.jlptLevel,
          firstSeenAt: row.firstSeenAt,
          timesSeen: row.timesSeen,
          sourceImageIds: row.sourceImageIds,
          reviewCount: row.trackReviewCount,
          confidenceLevel: row.trackConfidenceLevel,
          intervalDays: row.trackIntervalDays,
          easeFactor: row.trackEaseFactor,
          timesCorrect: row.trackTimesCorrect,
          nextReviewAt: row.trackNextReviewAt,
        });

        if (type !== "mixed" && items.length >= limit) break;
        if (type === "mixed" && items.length >= Math.ceil(limit / 2)) break;
      }
    }

    if (type === "vocab" || type === "mixed") {
      const remaining = type === "mixed" ? Math.max(limit - items.length, Math.floor(limit / 2)) : limit;

      const vocabTracks = await db
        .select({
          trackId: reviewTracks.id,
          trackQuestionType: reviewTracks.questionType,
          trackNextReviewAt: reviewTracks.nextReviewAt,
          trackIntervalDays: reviewTracks.intervalDays,
          trackEaseFactor: reviewTracks.easeFactor,
          trackReviewCount: reviewTracks.reviewCount,
          trackTimesCorrect: reviewTracks.timesCorrect,
          trackConfidenceLevel: reviewTracks.confidenceLevel,
          itemId: vocabulary.id,
          word: vocabulary.word,
          reading: vocabulary.reading,
          meanings: vocabulary.meanings,
          partOfSpeech: vocabulary.partOfSpeech,
          jlptLevel: vocabulary.jlptLevel,
          firstSeenAt: vocabulary.firstSeenAt,
          timesSeen: vocabulary.timesSeen,
          sourceImageIds: vocabulary.sourceImageIds,
        })
        .from(reviewTracks)
        .innerJoin(vocabulary, eq(reviewTracks.itemId, vocabulary.id))
        .where(
          and(
            eq(reviewTracks.userId, userId),
            eq(reviewTracks.itemType, "vocab"),
            or(
              lte(reviewTracks.nextReviewAt, now),
              isNull(reviewTracks.nextReviewAt),
            ),
          ),
        )
        .orderBy(
          sql`CASE WHEN ${reviewTracks.nextReviewAt} IS NULL THEN 1 ELSE 0 END`,
          asc(reviewTracks.nextReviewAt),
        )
        .limit(remaining * 2);

      let vocabCount = 0;
      for (const row of vocabTracks) {
        if (seenItemIds.has(row.itemId)) continue;
        seenItemIds.add(row.itemId);

        items.push({
          id: row.itemId,
          trackId: row.trackId,
          type: "vocab",
          questionType: row.trackQuestionType as "meaning" | "reading",
          prompt: row.word,
          readings: [row.reading],
          meanings: row.meanings,
          partOfSpeech: row.partOfSpeech,
          jlptLevel: row.jlptLevel,
          firstSeenAt: row.firstSeenAt,
          timesSeen: row.timesSeen,
          sourceImageIds: row.sourceImageIds,
          reviewCount: row.trackReviewCount,
          confidenceLevel: row.trackConfidenceLevel,
          intervalDays: row.trackIntervalDays,
          easeFactor: row.trackEaseFactor,
          timesCorrect: row.trackTimesCorrect,
          nextReviewAt: row.trackNextReviewAt,
        });

        vocabCount++;
        if (vocabCount >= remaining) break;
      }
    }

    if (type === "mixed" && items.length > 1) {
      items.sort(() => Math.random() - 0.5);
    }

    // Get first source image URL for personal context
    const sourceImageMap: Record<string, string | null> = {};
    const allSourceIds = [...new Set(items.flatMap((i) => i.sourceImageIds))].filter(Boolean) as string[];
    if (allSourceIds.length > 0) {
      const sources = await db
        .select({ id: sourceImages.id, imageUrl: sourceImages.imageUrl })
        .from(sourceImages)
        .where(inArray(sourceImages.id, allSourceIds));
      for (const s of sources) {
        sourceImageMap[s.id] = s.imageUrl;
      }
    }

    // Look up kanji details for vocab items
    const kanjiRegex = /[\u4e00-\u9faf\u3400-\u4dbf]/g;
    const vocabKanjiChars = new Set<string>();
    for (const item of items) {
      if (item.type === "vocab") {
        const matches = item.prompt.match(kanjiRegex);
        if (matches) matches.forEach((ch) => vocabKanjiChars.add(ch));
      }
    }

    const kanjiDetailsMap: Record<string, string[]> = {};
    if (vocabKanjiChars.size > 0) {
      const kanjiRows = await db
        .select({ character: kanji.character, meanings: kanji.meanings })
        .from(kanji)
        .where(
          and(
            eq(kanji.userId, userId),
            inArray(kanji.character, [...vocabKanjiChars]),
          )
        );
      for (const row of kanjiRows) {
        kanjiDetailsMap[row.character] = row.meanings;
      }
    }

    const enrichedItems = items.slice(0, limit).map((item) => {
      const base = {
        ...item,
        sourceImageUrl: item.sourceImageIds.length > 0
          ? sourceImageMap[item.sourceImageIds[0]] || null
          : null,
      };

      if (item.type === "vocab") {
        const chars = item.prompt.match(kanjiRegex) || [];
        const details = chars
          .filter((ch, i, arr) => arr.indexOf(ch) === i)
          .filter((ch) => kanjiDetailsMap[ch])
          .map((ch) => ({ character: ch, meanings: kanjiDetailsMap[ch] }));
        return { ...base, kanjiDetails: details.length > 0 ? details : undefined };
      }

      return base;
    });

    // Due counts: count due tracks (not items)
    const [kanjiDueCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviewTracks)
      .where(
        and(
          eq(reviewTracks.userId, userId),
          eq(reviewTracks.itemType, "kanji"),
          or(lte(reviewTracks.nextReviewAt, now), isNull(reviewTracks.nextReviewAt)),
        ),
      );

    const [vocabDueCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviewTracks)
      .where(
        and(
          eq(reviewTracks.userId, userId),
          eq(reviewTracks.itemType, "vocab"),
          or(lte(reviewTracks.nextReviewAt, now), isNull(reviewTracks.nextReviewAt)),
        ),
      );

    return NextResponse.json({
      items: enrichedItems,
      totalDue: {
        kanji: kanjiDueCount.count,
        vocab: vocabDueCount.count,
        total: kanjiDueCount.count + vocabDueCount.count,
      },
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Review queue error:", error);
    return NextResponse.json(
      { error: "Failed to fetch review queue" },
      { status: 500 },
    );
  }
}
