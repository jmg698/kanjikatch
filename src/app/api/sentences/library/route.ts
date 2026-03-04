import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, generatedSentences, generatedSentenceTargets } from "@/db";
import { eq, desc, and, inArray } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filterItem = searchParams.get("item"); // filter by target item text
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = (page - 1) * limit;

    let sentenceIds: string[] | null = null;

    if (filterItem) {
      const matchingTargets = await db
        .select({ sentenceId: generatedSentenceTargets.sentenceId })
        .from(generatedSentenceTargets)
        .where(eq(generatedSentenceTargets.itemText, filterItem));

      sentenceIds = matchingTargets.map((t) => t.sentenceId);
      if (sentenceIds.length === 0) {
        return NextResponse.json({ sentences: [], total: 0, page, hasMore: false });
      }
    }

    const conditions = [eq(generatedSentences.userId, userId)];
    if (sentenceIds) {
      conditions.push(inArray(generatedSentences.id, sentenceIds));
    }

    const sentences = await db
      .select()
      .from(generatedSentences)
      .where(and(...conditions))
      .orderBy(desc(generatedSentences.createdAt))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = sentences.length > limit;
    const pageSentences = sentences.slice(0, limit);

    // Fetch targets for these sentences
    const ids = pageSentences.map((s) => s.id);
    const targets = ids.length > 0
      ? await db
          .select()
          .from(generatedSentenceTargets)
          .where(inArray(generatedSentenceTargets.sentenceId, ids))
      : [];

    // Get all unique target items for filter list
    const allTargets = await db
      .select({
        itemText: generatedSentenceTargets.itemText,
        itemType: generatedSentenceTargets.itemType,
      })
      .from(generatedSentenceTargets)
      .innerJoin(generatedSentences, eq(generatedSentences.id, generatedSentenceTargets.sentenceId))
      .where(eq(generatedSentences.userId, userId));

    const uniqueTargetItems = [...new Map(allTargets.map((t) => [t.itemText, t])).values()];

    return NextResponse.json({
      sentences: pageSentences.map((s) => ({
        ...s,
        targets: targets.filter((t) => t.sentenceId === s.id),
      })),
      filterOptions: uniqueTargetItems,
      page,
      hasMore,
    });
  } catch (error) {
    console.error("Library fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch library" }, { status: 500 });
  }
}
