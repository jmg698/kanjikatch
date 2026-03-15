import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { db, kanji, vocabulary, sentences } from "@/db";
import { eq, desc, asc, and, or, ilike, inArray, sql, count } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

const VALID_TABS = ["kanji", "vocabulary", "sentences"] as const;
type Tab = (typeof VALID_TABS)[number];

const VALID_SORTS = ["recent", "oldest", "alphabetical", "next_review", "jlpt_asc", "jlpt_desc"] as const;
type Sort = (typeof VALID_SORTS)[number];

const VALID_STAGES = ["new", "learning", "reviewing", "known"] as const;

function parseCommaSeparated(val: string | null): string[] {
  if (!val) return [];
  return val.split(",").map((s) => s.trim()).filter(Boolean);
}

function sanitizeSearch(q: string): string {
  return q.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tab = (searchParams.get("tab") || "kanji") as Tab;
    if (!VALID_TABS.includes(tab)) {
      return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
    }

    const rawQuery = searchParams.get("q")?.trim() || "";
    const searchTerm = rawQuery ? `%${sanitizeSearch(rawQuery)}%` : null;
    const jlptLevels = parseCommaSeparated(searchParams.get("jlpt"))
      .map(Number)
      .filter((n) => n >= 1 && n <= 5);
    const stages = parseCommaSeparated(searchParams.get("stage"))
      .filter((s) => (VALID_STAGES as readonly string[]).includes(s));
    const sortBy = (searchParams.get("sort") || "recent") as Sort;
    if (!VALID_SORTS.includes(sortBy)) {
      return NextResponse.json({ error: "Invalid sort" }, { status: 400 });
    }
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "50", 10)), 100);
    const offset = (page - 1) * limit;

    if (tab === "kanji") {
      const conditions: SQL[] = [eq(kanji.userId, userId)];

      if (searchTerm) {
        conditions.push(
          or(
            ilike(kanji.character, searchTerm),
            sql`array_to_string(${kanji.meanings}, ',') ILIKE ${searchTerm}`,
            sql`array_to_string(${kanji.readingsOn}, ',') ILIKE ${searchTerm}`,
            sql`array_to_string(${kanji.readingsKun}, ',') ILIKE ${searchTerm}`,
          )!,
        );
      }

      if (jlptLevels.length > 0) {
        conditions.push(inArray(kanji.jlptLevel, jlptLevels));
      }

      if (stages.length > 0) {
        conditions.push(inArray(kanji.confidenceLevel, stages));
      }

      const where = and(...conditions)!;

      const orderBy = (() => {
        switch (sortBy) {
          case "oldest": return asc(kanji.firstSeenAt);
          case "alphabetical": return asc(kanji.character);
          case "next_review": return asc(kanji.nextReviewAt);
          case "jlpt_asc": return asc(kanji.jlptLevel);
          case "jlpt_desc": return desc(kanji.jlptLevel);
          case "recent":
          default: return desc(kanji.lastSeenAt);
        }
      })();

      const [items, [{ total }]] = await Promise.all([
        db.select().from(kanji).where(where).orderBy(orderBy).limit(limit).offset(offset),
        db.select({ total: count() }).from(kanji).where(where),
      ]);

      return NextResponse.json({
        items,
        total,
        page,
        hasMore: offset + items.length < total,
      });
    }

    if (tab === "vocabulary") {
      const conditions: SQL[] = [eq(vocabulary.userId, userId)];

      if (searchTerm) {
        conditions.push(
          or(
            ilike(vocabulary.word, searchTerm),
            ilike(vocabulary.reading, searchTerm),
            sql`array_to_string(${vocabulary.meanings}, ',') ILIKE ${searchTerm}`,
          )!,
        );
      }

      if (jlptLevels.length > 0) {
        conditions.push(inArray(vocabulary.jlptLevel, jlptLevels));
      }

      if (stages.length > 0) {
        conditions.push(inArray(vocabulary.confidenceLevel, stages));
      }

      const where = and(...conditions)!;

      const orderBy = (() => {
        switch (sortBy) {
          case "oldest": return asc(vocabulary.firstSeenAt);
          case "alphabetical": return asc(vocabulary.word);
          case "next_review": return asc(vocabulary.nextReviewAt);
          case "jlpt_asc": return asc(vocabulary.jlptLevel);
          case "jlpt_desc": return desc(vocabulary.jlptLevel);
          case "recent":
          default: return desc(vocabulary.lastSeenAt);
        }
      })();

      const [items, [{ total }]] = await Promise.all([
        db.select().from(vocabulary).where(where).orderBy(orderBy).limit(limit).offset(offset),
        db.select({ total: count() }).from(vocabulary).where(where),
      ]);

      return NextResponse.json({
        items,
        total,
        page,
        hasMore: offset + items.length < total,
      });
    }

    // Sentences tab
    const conditions: SQL[] = [eq(sentences.userId, userId)];

    if (searchTerm) {
      conditions.push(
        or(
          ilike(sentences.japanese, searchTerm),
          ilike(sentences.english!, searchTerm),
        )!,
      );
    }

    const where = and(...conditions)!;

    const orderBy = (() => {
      switch (sortBy) {
        case "oldest": return asc(sentences.createdAt);
        case "alphabetical": return asc(sentences.japanese);
        case "recent":
        default: return desc(sentences.createdAt);
      }
    })();

    const [items, [{ total }]] = await Promise.all([
      db.select().from(sentences).where(where).orderBy(orderBy).limit(limit).offset(offset),
      db.select({ total: count() }).from(sentences).where(where),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      hasMore: offset + items.length < total,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Library search error:", error);
    return NextResponse.json({ error: "Failed to search library" }, { status: 500 });
  }
}
