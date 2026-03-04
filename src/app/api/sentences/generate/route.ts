import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, generatedSentences, generatedSentenceTargets, reviewHistory, kanji, vocabulary } from "@/db";
import { eq, and, inArray } from "drizzle-orm";
import { generateWildSentences, type WildTargetItem } from "@/lib/ai";
import { z } from "zod";

const MAX_SENTENCES_PER_SESSION = 5;
const MAX_GENERATION_CALLS_PER_DAY = 20;

const requestSchema = z.object({
  sessionId: z.string().uuid(),
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

    // Check if we already generated for this session
    const existing = await db
      .select()
      .from(generatedSentences)
      .where(and(eq(generatedSentences.userId, userId), eq(generatedSentences.sessionId, sessionId)));

    if (existing.length > 0) {
      const targets = await db
        .select()
        .from(generatedSentenceTargets)
        .where(inArray(generatedSentenceTargets.sentenceId, existing.map((s) => s.id)));

      return NextResponse.json({
        sentences: existing.map((s) => ({
          ...s,
          targets: targets.filter((t) => t.sentenceId === s.id),
        })),
      });
    }

    // Rate limiting: count today's generations
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayGenerations = await db
      .select()
      .from(generatedSentences)
      .where(and(eq(generatedSentences.userId, userId)));
    const todayCount = todayGenerations.filter((s) => s.createdAt >= today).length;
    if (todayCount >= MAX_GENERATION_CALLS_PER_DAY * MAX_SENTENCES_PER_SESSION) {
      return NextResponse.json({ error: "Daily generation limit reached" }, { status: 429 });
    }

    // Get review history for this session to find which items were reviewed
    const history = await db
      .select()
      .from(reviewHistory)
      .where(eq(reviewHistory.sessionId, sessionId));

    if (history.length === 0) {
      return NextResponse.json({ sentences: [] });
    }

    // Prioritize items the user got wrong or has lower quality scores
    const sortedHistory = [...history].sort((a, b) => {
      if (a.wasCorrect !== b.wasCorrect) return a.wasCorrect ? 1 : -1;
      return a.quality - b.quality;
    });

    // Deduplicate by item (same item may appear with different question types)
    const seen = new Set<string>();
    const uniqueItems = sortedHistory.filter((h) => {
      const key = `${h.itemType}:${h.itemId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Take up to 8 items to focus on
    const targetHistoryItems = uniqueItems.slice(0, 8);

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

    // Check for existing sentences covering these items
    const targetTexts = targets.map((t) => t.text);
    const existingTargets = await db
      .select()
      .from(generatedSentenceTargets)
      .where(
        and(
          inArray(generatedSentenceTargets.itemText, targetTexts),
        ),
      );

    // Find which items already have sentence coverage for this user
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

    // Figure out which items still need new sentences
    const coveredTexts = new Set(existingTargets.map((t) => t.itemText));
    const uncoveredTargets = targets.filter((t) => !coveredTexts.has(t.text));

    let newSentences: typeof existing = [];

    if (uncoveredTargets.length > 0) {
      const generated = await generateWildSentences(uncoveredTargets);

      // Deduplicate: don't store same Japanese text twice for this user
      const existingJapanese = new Set(
        [...reusedSentences, ...todayGenerations].map((s) => s.japanese),
      );

      for (const sentence of generated) {
        if (existingJapanese.has(sentence.japanese)) continue;
        existingJapanese.add(sentence.japanese);

        const [inserted] = await db
          .insert(generatedSentences)
          .values({
            userId,
            sessionId,
            japanese: sentence.japanese,
            english: sentence.english,
            words: sentence.words,
          })
          .returning();

        // Create target links
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

    // Link reused sentences to this session too
    for (const s of reusedSentences) {
      if (!s.sessionId || s.sessionId !== sessionId) {
        // Don't update existing sessions; the reused sentences keep their original session link.
        // They'll still appear via the target relationship.
      }
    }

    const allSentences = [...reusedSentences.slice(0, 2), ...newSentences].slice(0, MAX_SENTENCES_PER_SESSION);

    // Fetch all targets for returned sentences
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
        targets: allTargets.filter((t) => t.sentenceId === s.id),
      })),
    });
  } catch (error) {
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
