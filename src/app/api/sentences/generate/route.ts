import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { db, generatedSentences, generatedSentenceTargets, reviewHistory, kanji, vocabulary } from "@/db";
import { eq, and, inArray, isNotNull, isNull, desc, gte, asc } from "drizzle-orm";
import { generateWildSentences, type WildTargetItem, type DifficultyProfile } from "@/lib/ai";
import { annotateWords } from "@/lib/wild-annotation";
import { loadStudiedCorpus } from "@/lib/wild-annotation-server";
import { z } from "zod";

const DEFAULT_END_COUNT = 5;
const REDUCED_END_COUNT = 3; // when interludes already happened this session
const SEGMENT_SIZE = 25; // matches ReviewSession interlude cadence
const MAX_GENERATION_CALLS_PER_DAY = 20;
type WildCoverageScope = "all_time" | "session" | "window_7d";
const WILD_COVERAGE_SCOPE: WildCoverageScope = "window_7d";

const requestSchema = z.object({
  sessionId: z.string().uuid(),
  // When provided, generate (or fetch cached) sentences for a specific
  // mid-session interlude segment. Items targeted are drawn from the
  // [segmentIndex*25, segmentIndex*25 + 25) slice of review history for
  // this session, in original-completion order.
  segmentIndex: z.number().int().min(0).optional(),
  // Number of sentences to return. Interludes pass 2; end-of-session passes 3
  // (when interludes already happened) or 5 (default, no interludes).
  count: z.number().int().min(1).max(10).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { sessionId } = parsed.data;
    const segmentIndex = parsed.data.segmentIndex ?? null;

    const corpus = await loadStudiedCorpus(userId);

    // For the end-of-session closer, gather any prior interlude segments so
    // the user can revisit them as a "continue reading" tail. We fetch this
    // up-front because both the cache-hit and cache-miss branches need it.
    let priorSegmentRows: typeof generatedSentences.$inferSelect[] = [];
    if (segmentIndex === null) {
      priorSegmentRows = await db
        .select()
        .from(generatedSentences)
        .where(
          and(
            eq(generatedSentences.userId, userId),
            eq(generatedSentences.sessionId, sessionId),
            isNotNull(generatedSentences.segmentIndex),
          ),
        )
        .orderBy(asc(generatedSentences.segmentIndex), asc(generatedSentences.createdAt));
    }

    // Default count: 3 when interludes already happened (so the closer is a
    // tight wrap-up), 5 otherwise (the historical full reading).
    const fallbackCount = segmentIndex === null && priorSegmentRows.length > 0
      ? REDUCED_END_COUNT
      : DEFAULT_END_COUNT;
    const count = parsed.data.count ?? fallbackCount;

    // Cache check: rows are scoped to (sessionId, segmentIndex). Note that
    // `segmentIndex IS NULL` represents the end-of-session closer; numbered
    // segments are interludes.
    const cacheCondition = segmentIndex === null
      ? and(
          eq(generatedSentences.userId, userId),
          eq(generatedSentences.sessionId, sessionId),
          isNull(generatedSentences.segmentIndex),
        )
      : and(
          eq(generatedSentences.userId, userId),
          eq(generatedSentences.sessionId, sessionId),
          eq(generatedSentences.segmentIndex, segmentIndex),
        );

    const existing = await db.select().from(generatedSentences).where(cacheCondition);

    if (existing.length > 0) {
      const idsForTargets = [
        ...existing.map((s) => s.id),
        ...priorSegmentRows.map((s) => s.id),
      ];
      const targets = idsForTargets.length > 0
        ? await db
            .select()
            .from(generatedSentenceTargets)
            .where(inArray(generatedSentenceTargets.sentenceId, idsForTargets))
        : [];

      return NextResponse.json({
        sentences: existing.map((s) => ({
          ...s,
          words: annotateWords(Array.isArray(s.words) ? s.words : [], corpus),
          targets: targets.filter((t) => t.sentenceId === s.id),
        })),
        priorSegmentSentences: priorSegmentRows.map((s) => ({
          ...s,
          words: annotateWords(Array.isArray(s.words) ? s.words : [], corpus),
          targets: targets.filter((t) => t.sentenceId === s.id),
        })),
      });
    }

    // Daily rate limit (per user, per calendar day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayGenerations = await db
      .select()
      .from(generatedSentences)
      .where(eq(generatedSentences.userId, userId));
    const todayCount = todayGenerations.filter((s) => s.createdAt >= today).length;
    if (todayCount >= MAX_GENERATION_CALLS_PER_DAY * DEFAULT_END_COUNT) {
      return NextResponse.json({ error: "Daily generation limit reached" }, { status: 429 });
    }

    // Pull review history for this session in original-completion order.
    // Retries are session-local and never write to reviewHistory, so this is
    // a faithful timeline of first-appearance grades.
    const history = await db
      .select()
      .from(reviewHistory)
      .where(and(eq(reviewHistory.sessionId, sessionId), eq(reviewHistory.userId, userId)))
      .orderBy(asc(reviewHistory.reviewedAt));

    if (history.length === 0) {
      return NextResponse.json({ sentences: [] });
    }

    // Dedupe by item (the same item can appear with both meaning and reading
    // question types). First occurrence wins to preserve the timeline.
    const seen = new Set<string>();
    const orderedItems = history.filter((h) => {
      const key = `${h.itemType}:${h.itemId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Slice into the requested segment. For segmentIndex === null we operate
    // on the closer pool: all items not yet featured in prior segments.
    let candidatePool = orderedItems;
    if (segmentIndex !== null) {
      const start = segmentIndex * SEGMENT_SIZE;
      const end = start + SEGMENT_SIZE;
      candidatePool = orderedItems.slice(start, end);
    } else {
      // End-of-session closer: exclude items already targeted in prior
      // interlude segments so the closer feels like fresh material.
      const priorSegmentSentences = await db
        .select({ id: generatedSentences.id })
        .from(generatedSentences)
        .where(
          and(
            eq(generatedSentences.userId, userId),
            eq(generatedSentences.sessionId, sessionId),
            isNotNull(generatedSentences.segmentIndex),
          ),
        );

      if (priorSegmentSentences.length > 0) {
        const priorTargetRows = await db
          .select({ itemId: generatedSentenceTargets.itemId })
          .from(generatedSentenceTargets)
          .where(inArray(generatedSentenceTargets.sentenceId, priorSegmentSentences.map((s) => s.id)));
        const priorItemIds = new Set(priorTargetRows.map((r) => r.itemId));
        const filtered = orderedItems.filter((h) => !priorItemIds.has(h.itemId));
        // Fall back to the full pool if filtering would leave us empty.
        candidatePool = filtered.length > 0 ? filtered : orderedItems;
      }
    }

    if (candidatePool.length === 0) {
      return NextResponse.json({ sentences: [] });
    }

    // Prioritize misses / lower quality first.
    const sortedPool = [...candidatePool].sort((a, b) => {
      if (a.wasCorrect !== b.wasCorrect) return a.wasCorrect ? 1 : -1;
      return a.quality - b.quality;
    });

    // Cap how many distinct items we hand to the LLM. End-of-session keeps
    // the historical 8; interludes feel tighter at 5 since they only need
    // 2 sentences.
    const targetCap = segmentIndex === null ? 8 : 5;
    const targetHistoryItems = sortedPool.slice(0, targetCap);

    const kanjiIds = targetHistoryItems.filter((h) => h.itemType === "kanji").map((h) => h.itemId);
    const vocabIds = targetHistoryItems.filter((h) => h.itemType === "vocab").map((h) => h.itemId);

    const [kanjiItems, vocabItems] = await Promise.all([
      kanjiIds.length > 0
        ? db.select().from(kanji).where(inArray(kanji.id, kanjiIds))
        : Promise.resolve([]),
      vocabIds.length > 0
        ? db.select().from(vocabulary).where(inArray(vocabulary.id, vocabIds))
        : Promise.resolve([]),
    ]);

    const targets: WildTargetItem[] = [
      ...kanjiItems.map((k) => ({
        id: k.id,
        type: "kanji" as const,
        text: k.character,
        meanings: k.meanings,
      })),
      ...vocabItems.map((v) => ({
        id: v.id,
        type: "vocab" as const,
        text: v.word,
        meanings: v.meanings,
        reading: v.reading,
      })),
    ];

    if (targets.length === 0) {
      return NextResponse.json({ sentences: [] });
    }

    // Coverage check: reuse already-generated sentences for these items
    // (subject to the configured scope). For interludes we still allow reuse,
    // since the user benefits from contextual repetition.
    const targetTexts = targets.map((t) => t.text);
    const coverageQuery = db
      .select({
        sentenceId: generatedSentenceTargets.sentenceId,
        itemText: generatedSentenceTargets.itemText,
      })
      .from(generatedSentenceTargets)
      .innerJoin(generatedSentences, eq(generatedSentenceTargets.sentenceId, generatedSentences.id));

    const existingTargets = WILD_COVERAGE_SCOPE === "session"
      ? await coverageQuery.where(
          and(
            eq(generatedSentences.userId, userId),
            inArray(generatedSentenceTargets.itemText, targetTexts),
            eq(generatedSentences.sessionId, sessionId),
          ),
        )
      : WILD_COVERAGE_SCOPE === "window_7d"
        ? await coverageQuery.where(
            and(
              eq(generatedSentences.userId, userId),
              inArray(generatedSentenceTargets.itemText, targetTexts),
              gte(generatedSentences.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
            ),
          )
        : await coverageQuery.where(
            and(
              eq(generatedSentences.userId, userId),
              inArray(generatedSentenceTargets.itemText, targetTexts),
            ),
          );

    const coveredSentenceIds = [...new Set(existingTargets.map((t) => t.sentenceId))];
    let reusedSentences: typeof existing = [];

    if (coveredSentenceIds.length > 0) {
      reusedSentences = await db
        .select()
        .from(generatedSentences)
        .where(
          and(
            eq(generatedSentences.userId, userId),
            inArray(generatedSentences.id, coveredSentenceIds),
          ),
        );
    }

    const coveredTexts = new Set(existingTargets.map((t) => t.itemText));
    const uncoveredTargets = targets.filter((t) => !coveredTexts.has(t.text));

    const newSentences: typeof existing = [];

    if (uncoveredTargets.length > 0) {
      const recentRated = await db
        .select({ difficultyRating: generatedSentences.difficultyRating })
        .from(generatedSentences)
        .where(
          and(
            eq(generatedSentences.userId, userId),
            isNotNull(generatedSentences.difficultyRating),
          ),
        )
        .orderBy(desc(generatedSentences.ratedAt))
        .limit(30);

      let difficultyProfile: DifficultyProfile | undefined;
      if (recentRated.length >= 5) {
        const total = recentRated.length;
        const tooEasy = recentRated.filter((r) => r.difficultyRating === "too_easy").length;
        const justRight = recentRated.filter((r) => r.difficultyRating === "just_right").length;
        const tooHard = recentRated.filter((r) => r.difficultyRating === "too_hard").length;
        difficultyProfile = {
          tooEasyPct: Math.round((tooEasy / total) * 100),
          justRightPct: Math.round((justRight / total) * 100),
          tooHardPct: Math.round((tooHard / total) * 100),
          totalRated: total,
        };
      }

      const generated = await generateWildSentences(uncoveredTargets, difficultyProfile);

      const existingJapanese = new Set(
        [...reusedSentences, ...todayGenerations].map((s) => s.japanese),
      );

      for (const sentence of generated) {
        if (existingJapanese.has(sentence.japanese)) continue;
        existingJapanese.add(sentence.japanese);

        const annotatedWords = annotateWords(sentence.words, corpus);

        const [inserted] = await db
          .insert(generatedSentences)
          .values({
            userId,
            sessionId,
            segmentIndex,
            japanese: sentence.japanese,
            english: sentence.english,
            words: annotatedWords,
          })
          .returning();

        const matchedTargets = targets.filter((t) =>
          sentence.targetItems.includes(t.text),
        );

        if (matchedTargets.length > 0) {
          await db.insert(generatedSentenceTargets).values(
            matchedTargets.map((t) => ({
              sentenceId: inserted.id,
              itemType: t.type,
              itemId: t.id,
              itemText: t.text,
            })),
          );
        }

        newSentences.push(inserted);
      }
    }

    // Compose the response: prefer fresh sentences first, fill with reused.
    const reuseSlots = Math.max(0, count - newSentences.length);
    const allSentences = [
      ...newSentences,
      ...reusedSentences.slice(0, reuseSlots),
    ].slice(0, count);

    const allSentenceIds = [
      ...allSentences.map((s) => s.id),
      ...priorSegmentRows.map((s) => s.id),
    ];
    const allTargets = allSentenceIds.length > 0
      ? await db
          .select()
          .from(generatedSentenceTargets)
          .where(inArray(generatedSentenceTargets.sentenceId, allSentenceIds))
      : [];

    return NextResponse.json({
      sentences: allSentences.map((s) => ({
        ...s,
        words: annotateWords(Array.isArray(s.words) ? s.words : [], corpus),
        targets: allTargets.filter((t) => t.sentenceId === s.id),
      })),
      priorSegmentSentences: priorSegmentRows.map((s) => ({
        ...s,
        words: annotateWords(Array.isArray(s.words) ? s.words : [], corpus),
        targets: allTargets.filter((t) => t.sentenceId === s.id),
      })),
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Sentence generation error:", error);

    if (error instanceof Error && error.message.includes("overloaded")) {
      return NextResponse.json(
        { error: "AI is temporarily busy. Try again in a moment." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Failed to generate sentences" },
      { status: 500 },
    );
  }
}
