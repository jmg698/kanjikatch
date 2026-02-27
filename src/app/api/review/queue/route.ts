import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, kanji, vocabulary, sourceImages } from "@/db";
import { eq, and, or, lte, isNull, asc, sql, inArray } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "mixed"; // 'kanji' | 'vocab' | 'mixed'
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);

    const now = new Date();

    type ReviewItem = {
      id: string;
      type: "kanji" | "vocab";
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

    if (type === "kanji" || type === "mixed") {
      const kanjiDue = await db
        .select()
        .from(kanji)
        .where(
          and(
            eq(kanji.userId, userId),
            or(
              lte(kanji.nextReviewAt, now),
              isNull(kanji.nextReviewAt),
            )
          )
        )
        .orderBy(
          // Overdue items first (non-null and past due), then new items (null)
          sql`CASE WHEN ${kanji.nextReviewAt} IS NULL THEN 1 ELSE 0 END`,
          asc(kanji.nextReviewAt),
        )
        .limit(type === "mixed" ? Math.ceil(limit / 2) : limit);

      for (const k of kanjiDue) {
        items.push({
          id: k.id,
          type: "kanji",
          prompt: k.character,
          readings: k.readingsOn,
          readingsKun: k.readingsKun,
          meanings: k.meanings,
          jlptLevel: k.jlptLevel,
          firstSeenAt: k.firstSeenAt,
          timesSeen: k.timesSeen,
          sourceImageIds: k.sourceImageIds,
          reviewCount: k.reviewCount,
          confidenceLevel: k.confidenceLevel,
          intervalDays: k.intervalDays,
          easeFactor: k.easeFactor,
          timesCorrect: k.timesCorrect,
          nextReviewAt: k.nextReviewAt,
        });
      }
    }

    if (type === "vocab" || type === "mixed") {
      const remaining = type === "mixed" ? Math.max(limit - items.length, Math.floor(limit / 2)) : limit;
      const vocabDue = await db
        .select()
        .from(vocabulary)
        .where(
          and(
            eq(vocabulary.userId, userId),
            or(
              lte(vocabulary.nextReviewAt, now),
              isNull(vocabulary.nextReviewAt),
            )
          )
        )
        .orderBy(
          sql`CASE WHEN ${vocabulary.nextReviewAt} IS NULL THEN 1 ELSE 0 END`,
          asc(vocabulary.nextReviewAt),
        )
        .limit(remaining);

      for (const v of vocabDue) {
        items.push({
          id: v.id,
          type: "vocab",
          prompt: v.word,
          readings: [v.reading],
          meanings: v.meanings,
          partOfSpeech: v.partOfSpeech,
          jlptLevel: v.jlptLevel,
          firstSeenAt: v.firstSeenAt,
          timesSeen: v.timesSeen,
          sourceImageIds: v.sourceImageIds,
          reviewCount: v.reviewCount,
          confidenceLevel: v.confidenceLevel,
          intervalDays: v.intervalDays,
          easeFactor: v.easeFactor,
          timesCorrect: v.timesCorrect,
          nextReviewAt: v.nextReviewAt,
        });
      }
    }

    // For mixed, interleave kanji and vocab so it's not all-kanji-then-all-vocab
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

    const enrichedItems = items.slice(0, limit).map((item) => ({
      ...item,
      sourceImageUrl: item.sourceImageIds.length > 0
        ? sourceImageMap[item.sourceImageIds[0]] || null
        : null,
    }));

    // Get total due counts for the header
    const [kanjiDueCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(kanji)
      .where(and(eq(kanji.userId, userId), or(lte(kanji.nextReviewAt, now), isNull(kanji.nextReviewAt))));

    const [vocabDueCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vocabulary)
      .where(and(eq(vocabulary.userId, userId), or(lte(vocabulary.nextReviewAt, now), isNull(vocabulary.nextReviewAt))));

    return NextResponse.json({
      items: enrichedItems,
      totalDue: {
        kanji: kanjiDueCount.count,
        vocab: vocabDueCount.count,
        total: kanjiDueCount.count + vocabDueCount.count,
      },
    });
  } catch (error) {
    console.error("Review queue error:", error);
    return NextResponse.json(
      { error: "Failed to fetch review queue" },
      { status: 500 },
    );
  }
}
