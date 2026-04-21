import Anthropic from "@anthropic-ai/sdk";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, vocabularyEnrichmentCache } from "@/db";

/**
 * Vocabulary enrichment service.
 *
 * Given a Japanese word (and optionally the sentence it appeared in), this
 * returns a complete dictionary entry: canonical hiragana reading, a small
 * set of English meanings, part of speech, and JLPT level.
 *
 * Design notes:
 *  - We use Haiku because enrichment is a narrow, single-word task. Switching
 *    off Sonnet keeps the per-call cost well under a cent so we can enrich
 *    every quick-add without worrying about budget.
 *  - Results are cached globally by (word, reading). A dictionary entry is not
 *    per-user data, so the first user to look up 定年 pays the AI cost and
 *    every subsequent user gets an instant DB read.
 *  - The response is validated against a strict Zod schema that explicitly
 *    rejects placeholder-looking strings ("added from reading", bare
 *    parenthetical notes, transliterations). If validation fails, we throw so
 *    the caller can record that enrichment is still needed.
 */

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Haiku 3.5 is fast and ~10x cheaper than Sonnet. Upgrade to a newer Haiku
// version here when available — no other code changes needed.
const ENRICHMENT_MODEL = "claude-3-5-haiku-20241022";

const KANA_REGEX = /^[\u3040-\u309F\u30A0-\u30FFー・\s]+$/;

// Patterns that disqualify a "meaning" string — these are all signs that the
// model returned a placeholder / meta-comment / non-gloss instead of a real
// English definition.
const PLACEHOLDER_MEANING_PATTERNS: RegExp[] = [
  /^\s*\(.*\)\s*$/, // entirely parenthetical: "(added from reading)"
  /added from reading/i,
  /placeholder/i,
  /pending/i,
  /no (definition|meaning)/i,
  /^unknown$/i,
  /^n\/?a$/i,
  /^-+$/,
];

function isMeaningfulGloss(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length < 2) return false;
  return !PLACEHOLDER_MEANING_PATTERNS.some((re) => re.test(trimmed));
}

const enrichmentResultSchema = z.object({
  reading: z
    .string()
    .min(1)
    .max(100)
    .refine((s) => KANA_REGEX.test(s), {
      message: "reading must contain only hiragana/katakana",
    }),
  meanings: z
    .array(
      z
        .string()
        .min(1)
        .max(200)
        .transform((s) => s.trim())
        .refine(isMeaningfulGloss, {
          message: "meaning must be a real English gloss, not a placeholder",
        })
    )
    .min(1)
    .max(5),
  partOfSpeech: z.string().max(50).nullable(),
  jlptLevel: z.number().int().min(1).max(5).nullable(),
});

export type EnrichmentResult = z.infer<typeof enrichmentResultSchema>;

export interface EnrichmentInput {
  word: string;
  /** Hint reading from partial AI data. Used to disambiguate homographs. */
  reading?: string | null;
  /** Partial meaning from the source context (e.g. wild sentence word). */
  hintMeaning?: string | null;
  /** The Japanese sentence the word was found in, for disambiguation. */
  sentenceJapanese?: string | null;
  /** English translation of the source sentence, if known. */
  sentenceEnglish?: string | null;
}

const ENRICHMENT_PROMPT = `You are a Japanese dictionary assistant helping an English-speaking learner add a single word to their vocabulary. Produce a complete, high-quality dictionary entry.

RULES (follow strictly):
1. READING: Hiragana only (or katakana for words normally written in katakana, e.g. コーヒー). NEVER include kanji in the reading.
2. MEANINGS: 1–4 concise English glosses. Each gloss is 1–6 words, lowercase. For verbs, use the dictionary-form English (e.g. "to eat", "to retire"). Do NOT wrap meanings in parentheses. Do NOT include meta-comments like "(added from reading)", "unknown", "n/a", or romaji transliterations. If a sentence is provided, rank meanings so the contextually correct one is first.
3. PART OF SPEECH: exactly one of — noun, verb, i-adjective, na-adjective, adverb, particle, conjunction, expression, pronoun, counter, interjection, prefix, suffix. Use null if it genuinely cannot be classified.
4. JLPT LEVEL: 1–5 where 5 = easiest (N5) and 1 = hardest (N1). Use null if you are unsure or the word is beyond JLPT.
5. INFLECTED FORMS: If the word is an inflected or conjugated form (e.g. 食べて, 行きました), normalize to the DICTIONARY FORM and return the reading/meaning/part of speech for the dictionary form.
6. If you genuinely cannot produce a real definition, return an empty "meanings" array. Never invent a placeholder.

Return ONLY valid JSON in this exact shape:
{
  "reading": "ていねん",
  "meanings": ["retirement age", "mandatory retirement"],
  "partOfSpeech": "noun",
  "jlptLevel": 2
}`;

function buildUserMessage(input: EnrichmentInput): string {
  const lines: string[] = [];
  lines.push(`WORD: ${input.word}`);
  if (input.reading && input.reading.trim().length > 0 && input.reading !== input.word) {
    lines.push(`HINT_READING: ${input.reading}`);
  }
  if (input.hintMeaning && input.hintMeaning.trim().length > 0) {
    lines.push(`HINT_MEANING: ${input.hintMeaning}`);
  }
  if (input.sentenceJapanese && input.sentenceJapanese.trim().length > 0) {
    lines.push(`SENTENCE (Japanese): ${input.sentenceJapanese}`);
  }
  if (input.sentenceEnglish && input.sentenceEnglish.trim().length > 0) {
    lines.push(`SENTENCE (English): ${input.sentenceEnglish}`);
  }
  return lines.join("\n");
}

/**
 * Look up an existing cache entry. Matches on (word, reading) when a reading
 * is provided, otherwise returns the most recent entry for `word`.
 */
async function readCache(
  word: string,
  reading: string | null | undefined
): Promise<EnrichmentResult | null> {
  const rows = reading
    ? await db
        .select()
        .from(vocabularyEnrichmentCache)
        .where(
          and(
            eq(vocabularyEnrichmentCache.word, word),
            eq(vocabularyEnrichmentCache.reading, reading)
          )
        )
        .limit(1)
    : await db
        .select()
        .from(vocabularyEnrichmentCache)
        .where(eq(vocabularyEnrichmentCache.word, word))
        .orderBy(sql`${vocabularyEnrichmentCache.updatedAt} DESC`)
        .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    reading: row.reading,
    meanings: row.meanings,
    partOfSpeech: row.partOfSpeech,
    jlptLevel: row.jlptLevel,
  };
}

async function writeCache(word: string, result: EnrichmentResult): Promise<void> {
  await db
    .insert(vocabularyEnrichmentCache)
    .values({
      word,
      reading: result.reading,
      meanings: result.meanings,
      partOfSpeech: result.partOfSpeech,
      jlptLevel: result.jlptLevel,
    })
    .onConflictDoUpdate({
      target: [vocabularyEnrichmentCache.word, vocabularyEnrichmentCache.reading],
      set: {
        meanings: result.meanings,
        partOfSpeech: result.partOfSpeech,
        jlptLevel: result.jlptLevel,
        updatedAt: new Date(),
      },
    });
}

/**
 * Fetch a full dictionary entry for a word. Checks the global cache first,
 * then falls back to a Haiku call. Throws on any failure (AI error, malformed
 * JSON, schema validation failure, or empty meanings). Callers should catch
 * and either show an error or queue the row for later enrichment.
 */
export async function enrichVocabulary(
  input: EnrichmentInput
): Promise<EnrichmentResult> {
  const cached = await readCache(input.word, input.reading ?? null);
  if (cached) return cached;

  const userMessage = buildUserMessage(input);

  const response = await anthropic.messages.create({
    model: ENRICHMENT_MODEL,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `${ENRICHMENT_PROMPT}\n\n---\n\n${userMessage}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Enrichment: no text response from AI");
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Enrichment: no JSON in AI response");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const result = enrichmentResultSchema.parse(parsed);

  await writeCache(input.word, result);
  return result;
}
