import { db, sourceImages, kanji, vocabulary, sentences, grammarPatterns, studyGuides } from "@/db";
import { and, eq, inArray, sql, asc, desc } from "drizzle-orm";
import { sqlUuidArray } from "@/lib/pg-text-array";
import { getDefaultSourceName } from "@/lib/mastery";
import type { StudyGuideInput, StudyGuideGrammarInput } from "@/lib/ai";

export interface GuideListItem {
  id: string;
  title: string;
  createdAt: Date;
  sourceNames: string[];
}

/** The user's guides, newest first, with source names resolved for display. */
export async function listUserGuides(userId: string): Promise<GuideListItem[]> {
  const guides = await db
    .select({
      id: studyGuides.id,
      title: studyGuides.title,
      sourceImageIds: studyGuides.sourceImageIds,
      createdAt: studyGuides.createdAt,
    })
    .from(studyGuides)
    .where(eq(studyGuides.userId, userId))
    .orderBy(desc(studyGuides.createdAt));

  const allSourceIds = Array.from(new Set(guides.flatMap((g) => g.sourceImageIds)));
  const sources = allSourceIds.length > 0
    ? await db
        .select({ id: sourceImages.id, name: sourceImages.name, uploadedAt: sourceImages.uploadedAt })
        .from(sourceImages)
        .where(and(eq(sourceImages.userId, userId), inArray(sourceImages.id, allSourceIds)))
    : [];
  const nameById = new Map(
    sources.map((s) => [s.id, s.name ?? getDefaultSourceName(s.uploadedAt)]),
  );

  return guides.map((g) => ({
    id: g.id,
    title: g.title,
    createdAt: g.createdAt,
    sourceNames: g.sourceImageIds
      .map((id) => nameById.get(id))
      .filter((n): n is string => Boolean(n)),
  }));
}

export interface GuideSourceSummary {
  id: string;
  name: string;
}

export interface GuideMaterial {
  sources: GuideSourceSummary[];
  input: StudyGuideInput;
  itemCount: number;
}

/**
 * Collect everything the user saved from the given sources — the guide is
 * built from curated library items (what survived the confirmation screen),
 * not from the raw extraction.
 *
 * Returns null when any requested source doesn't exist, isn't the user's,
 * or hasn't been processed yet.
 */
export async function gatherGuideMaterial(
  userId: string,
  sourceImageIds: string[],
): Promise<GuideMaterial | null> {
  const sources = await db
    .select({
      id: sourceImages.id,
      name: sourceImages.name,
      uploadedAt: sourceImages.uploadedAt,
      processed: sourceImages.processed,
      errorMessage: sourceImages.errorMessage,
    })
    .from(sourceImages)
    .where(and(eq(sourceImages.userId, userId), inArray(sourceImages.id, sourceImageIds)));

  if (sources.length !== sourceImageIds.length) return null;
  if (sources.some((s) => !s.processed || s.errorMessage)) return null;

  const idArray = sqlUuidArray(sourceImageIds);

  const [kanjiRows, vocabRows, sentenceRows, grammarRows] = await Promise.all([
    db
      .select({
        character: kanji.character,
        readingsOn: kanji.readingsOn,
        readingsKun: kanji.readingsKun,
        meanings: kanji.meanings,
        jlptLevel: kanji.jlptLevel,
      })
      .from(kanji)
      .where(and(eq(kanji.userId, userId), sql`${kanji.sourceImageIds} && ${idArray}`))
      .orderBy(asc(kanji.firstSeenAt)),
    db
      .select({
        word: vocabulary.word,
        reading: vocabulary.reading,
        meanings: vocabulary.meanings,
        partOfSpeech: vocabulary.partOfSpeech,
        jlptLevel: vocabulary.jlptLevel,
      })
      .from(vocabulary)
      .where(and(eq(vocabulary.userId, userId), sql`${vocabulary.sourceImageIds} && ${idArray}`))
      .orderBy(asc(vocabulary.firstSeenAt)),
    db
      .select({
        japanese: sentences.japanese,
        english: sentences.english,
      })
      .from(sentences)
      .where(and(eq(sentences.userId, userId), inArray(sentences.sourceImageId, sourceImageIds)))
      .orderBy(asc(sentences.createdAt)),
    db
      .select()
      .from(grammarPatterns)
      .where(and(eq(grammarPatterns.userId, userId), sql`${grammarPatterns.sourceImageIds} && ${idArray}`))
      .orderBy(asc(grammarPatterns.firstSeenAt)),
  ]);

  const grammarInputs: StudyGuideGrammarInput[] = grammarRows.map((g) => ({
    pattern: g.pattern,
    label: g.label,
    structure: g.structure,
    explanation: g.explanation,
    register: g.register,
    nuance: g.nuance,
    jlptLevel: g.jlptLevel,
    examples: Array.isArray(g.examples)
      ? (g.examples as { japanese: string; english?: string | null }[])
      : [],
  }));

  const sourceSummaries = sources
    .sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime())
    .map((s) => ({ id: s.id, name: s.name ?? getDefaultSourceName(s.uploadedAt) }));

  return {
    sources: sourceSummaries,
    input: {
      sourceNames: sourceSummaries.map((s) => s.name),
      kanji: kanjiRows,
      vocabulary: vocabRows,
      sentences: sentenceRows,
      grammarPatterns: grammarInputs,
    },
    itemCount:
      kanjiRows.length + vocabRows.length + sentenceRows.length + grammarRows.length,
  };
}
