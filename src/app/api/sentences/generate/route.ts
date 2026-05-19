import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { db, generatedSentences, generatedSentenceTargets, reviewHistory, kanji, vocabulary } from "@/db";
import { eq, and, inArray, isNotNull, desc, gte, asc } from "drizzle-orm";
import { generateWildSentences, type WildTargetItem, type DifficultyProfile } from "@/lib/ai";
import { annotateWords } from "@/lib/wild-annotation";
import { loadStudiedCorpus } from "@/lib/wild-annotation-server";
import { assertCostProtection, getClientIp, hashIp } from "@/lib/cost-protection";
import { getTierContext } from "@/lib/tiers";
import { z } from "zod";

const DEFAULT_END_COUNT = 5;
const SEGMENT_SIZE = 25; // matches ReviewSession interlude cadence
const MAX_GENERATION_CALLS_PER_DAY = 20;
// Free-tier post-session cap (PRO_TIER_PLAN.md: "2 from shared library, no audio").
// Interludes are deliberately unlimited at this layer — the interlude cadence
// itself caps how often they fire, and the tier-specific count (1 free / 2 pro)
// is enforced by the calling component.
const FREE_POST_SESSION_SENTENCE_CAP = 2;
type WildCoverageScope = "all_time" | "session" | "window_7d";
const WILD_COVERAGE_SCOPE: WildCoverageScope = "window_7d";

const requestSchema = z.object({
  sessionId: z.string().uuid(),
  // When provided, generate sentences for a specific mid-session interlude
  // segment. Targets are drawn from the [segmentIndex*25, segmentIndex*25 + 25)
  // slice of review history. Interludes are NOT cached server-side — the
  // client tracks which segments it has already shown via a ref.
  segmentIndex: z.number().int().min(0).optional(),
  // Number of sentences to return.
  count: z.number().int().min(1).max(10).optional(),
  // For the end-of-session closer: item IDs already featured in mid-session
  // interludes, so the closer can prefer fresh material.
  excludeItemIds: z.array(z.string().uuid()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ipHash = hashIp(getClientIp(req));

    const guard = await assertCostProtection({ userId, ipHash, endpoint: "sentence_generate" });
    if (!guard.allowed) {
      return NextResponse.json(
        { error: guard.message, code: guard.reason },
        { status: guard.status, headers: { "Retry-After": String(guard.retryAfterSec) } },
      );
    }

    const tier = await getTierContext(userId);

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { sessionId } = parsed.data;
    const segmentIndex = parsed.data.segmentIndex ?? null;
    const requestedCount = parsed.data.count ?? DEFAULT_END_COUNT;
    const excludeItemIds = new Set(parsed.data.excludeItemIds ?? []);
    const isInterlude = segmentIndex !== null;

    // Free users hit the post-session sentence cap. Interludes are gated
    // separately (by the client) since the cadence already enforces scarcity.
    const count = !isInterlude && tier.isFree
      ? Math.min(requestedCount, FREE_POST_SESSION_SENTENCE_CAP)
      : requestedCount;

    const corpus = await loadStudiedCorpus(userId);

    // Cache check: only the end-of-session closer is cached server-side
    // (keyed by sessionId, original behavior). Mid-session interludes always
    // generate fresh — the client tracks segments it has already shown.
    if (!isInterlude) {
      const existing = await db
        .select()
        .from(generatedSentences)
        .where(
          and(
            eq(generatedSentences.userId, userId),
            eq(generatedSentences.sessionId, sessionId),
          ),
        );

      if (existing.length > 0) {
        // Apply the tier cap to the cache return. Without this slice, free
        // users who hit a session that was previously generated when the cap
        // logic was missing would see all stored rows (up to 5), bypassing
        // FREE_POST_SESSION_SENTENCE_CAP. The slice is also a safety net for
        // any future cache pollution.
        const cappedExisting = existing.slice(0, count);
        const cappedIds = new Set(cappedExisting.map((s) => s.id));
        const targets = await db
          .select()
          .from(generatedSentenceTargets)
          .where(inArray(generatedSentenceTargets.sentenceId, cappedExisting.map((s) => s.id)));

        return NextResponse.json({
          sentences: cappedExisting.map((s) => ({
            ...s,
            words: annotateWords(Array.isArray(s.words) ? s.words : [], corpus),
            targets: targets.filter((t) => cappedIds.has(t.sentenceId) && t.sentenceId === s.id),
          })),
          tier: tier.tier,
          isPro: tier.isPro,
          capped: !isInterlude && tier.isFree && existing.length > count,
        });
      }
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

    // Slice into the requested segment, or filter out items already used in
    // prior interlude segments for the closer.
    let candidatePool = orderedItems;
    if (isInterlude) {
      const start = segmentIndex * SEGMENT_SIZE;
      const end = start + SEGMENT_SIZE;
      candidatePool = orderedItems.slice(start, end);
    } else if (excludeItemIds.size > 0) {
      const filtered = orderedItems.filter((h) => !excludeItemIds.has(h.itemId));
      candidatePool = filtered.length > 0 ? filtered : orderedItems;
    }

    if (candidatePool.length === 0) {
      return NextResponse.json({ sentences: [] });
    }

    // Prioritize misses / lower quality first.
    const sortedPool = [...candidatePool].sort((a, b) => {
      if (a.wasCorrect !== b.wasCorrect) return a.wasCorrect ? 1 : -1;
      return a.quality - b.quality;
    });

    const targetCap = isInterlude ? 5 : 8;
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
    // (subject to the configured scope). Skipped for interludes — we want
    // fresh sentences in the moment, even if it costs an LLM call.
    const targetTexts = targets.map((t) => t.text);
    let reusedSentences: (typeof generatedSentences.$inferSelect)[] = [];
    let coveredTexts = new Set<string>();

    if (!isInterlude) {
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

      coveredTexts = new Set(existingTargets.map((t) => t.itemText));
    }

    const uncoveredTargets = targets.filter((t) => !coveredTexts.has(t.text));

    const newSentences: (typeof generatedSentences.$inferSelect)[] = [];

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

      const generated = await generateWildSentences(uncoveredTargets, difficultyProfile, {
        userId,
        ipHash,
        endpoint: "sentence_generate",
      });

      // Dedup against existing Japanese to avoid surfacing the same sentence
      // twice. For interludes we still dedupe against today's generations so
      // a session doesn't repeat itself.
      const existingJapanese = new Set(
        [...reusedSentences, ...todayGenerations].map((s) => s.japanese),
      );

      for (const sentence of generated) {
        // Closer-only: stop inserting once we've reached the capped count.
        // Without this break, the AI's response (which can return up to 5
        // sentences regardless of `count`) pollutes the session cache with
        // rows the response will never expose, and the next request to the
        // same sessionId served from cache could leak them past the cap.
        if (!isInterlude && newSentences.length + reusedSentences.length >= count) break;
        if (existingJapanese.has(sentence.japanese)) continue;
        existingJapanese.add(sentence.japanese);

        const annotatedWords = annotateWords(sentence.words, corpus);

        const [inserted] = await db
          .insert(generatedSentences)
          .values({
            userId,
            // Mid-session interludes are not associated with the session in
            // the DB — they're transient. Storing them under sessionId would
            // make them appear in the closer's cache and confuse the deck.
            sessionId: isInterlude ? null : sessionId,
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

    const allSentenceIds = allSentences.map((s) => s.id);
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
      // Surface the wall state so the InTheWild component can render a
      // "see Pro" card when free users hit the 2-sentence cap. Pro users
      // get { isPro: true } so the card is suppressed.
      tier: tier.tier,
      isPro: tier.isPro,
      capped: !isInterlude && tier.isFree && requestedCount > count,
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
