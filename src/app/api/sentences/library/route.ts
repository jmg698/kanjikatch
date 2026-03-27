import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { db, generatedSentences, generatedSentenceTargets } from "@/db";
import { eq, desc, asc, sql, and, or, ilike, inArray, count } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() || "";
    const sort = searchParams.get("sort") || "recent";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(generatedSentences.userId, userId)];

    if (query) {
      const searchTerm = `%${query}%`;

      const matchingTargets = await db
        .select({ sentenceId: generatedSentenceTargets.sentenceId })
        .from(generatedSentenceTargets)
        .innerJoin(generatedSentences, eq(generatedSentences.id, generatedSentenceTargets.sentenceId))
        .where(and(
          eq(generatedSentences.userId, userId),
          ilike(generatedSentenceTargets.itemText, searchTerm),
        ));

      const targetSentenceIds = matchingTargets.map((t) => t.sentenceId);

      const textSearch = or(
        ilike(generatedSentences.japanese, searchTerm),
        ilike(generatedSentences.english, searchTerm),
      )!;

      if (targetSentenceIds.length > 0) {
        conditions.push(or(
          textSearch,
          inArray(generatedSentences.id, targetSentenceIds),
        )!);
      } else {
        conditions.push(textSearch);
      }
    }

    const whereClause = and(...conditions)!;

    let orderBy: SQL;
    switch (sort) {
      case "oldest":
        orderBy = asc(generatedSentences.createdAt);
        break;
      case "alphabetical":
        orderBy = asc(generatedSentences.japanese);
        break;
      case "random":
        orderBy = sql`RANDOM()`;
        break;
      default:
        orderBy = desc(generatedSentences.createdAt);
    }

    const [totalResult, sentences] = await Promise.all([
      db.select({ count: count() }).from(generatedSentences).where(whereClause),
      db
        .select()
        .from(generatedSentences)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit + 1)
        .offset(offset),
    ]);

    const total = totalResult[0]?.count ?? 0;
    const hasMore = sentences.length > limit;
    const pageSentences = sentences.slice(0, limit);

    const ids = pageSentences.map((s) => s.id);
    const targets = ids.length > 0
      ? await db
          .select()
          .from(generatedSentenceTargets)
          .where(inArray(generatedSentenceTargets.sentenceId, ids))
      : [];

    return NextResponse.json({
      sentences: pageSentences.map((s) => ({
        ...s,
        targets: targets.filter((t) => t.sentenceId === s.id),
      })),
      total,
      page,
      hasMore,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Library fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch library" }, { status: 500 });
  }
}
