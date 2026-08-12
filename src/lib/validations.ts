import { z } from "zod";

/**
 * Hostnames we allow the server to fetch for image extraction (SSRF protection).
 * UploadThing serves files from utfs.io (legacy) and `{appId}.ufs.sh` (current).
 */
export function isAllowedExtractionImageUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (host === "utfs.io") return true;
    if (host.endsWith(".ufs.sh")) return true;
    if (host === "utf-staging.com") return true;
    return false;
  } catch {
    return false;
  }
}

/** Coerce model output like "N5", 5, null into JLPT 1–5 or null/undefined. */
const jlptLevelField = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return undefined;
  if (typeof v === "number" && Number.isFinite(v)) {
    const n = Math.round(v);
    return n >= 1 && n <= 5 ? n : undefined;
  }
  if (typeof v === "string") {
    const m = v.trim().match(/^N?([1-5])$/i);
    if (m) return parseInt(m[1], 10);
  }
  return undefined;
}, z.number().int().min(1).max(5).nullable().optional());

function readingsArraySchema() {
  return z.preprocess((v) => {
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === "string");
  }, z.array(z.string()));
}

// Kanji validation — tolerant of common model JSON quirks (null arrays, multi-char "character", etc.)
export const kanjiSchema = z.object({
  character: z
    .string()
    .min(1)
    .max(20)
    .transform((s) => Array.from(s.trim())[0] ?? s.trim())
    .refine((c) => c.length >= 1, "character required"),
  meanings: z.preprocess((v) => {
    const arr = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    return arr.length > 0 ? arr : ["(unspecified)"];
  }, z.array(z.string()).min(1)),
  readingsOn: readingsArraySchema(),
  readingsKun: readingsArraySchema(),
  jlptLevel: jlptLevelField,
  strokeCount: z.preprocess((v) => {
    if (v === null || v === undefined || v === "") return undefined;
    const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
    if (!Number.isFinite(n) || n < 1) return undefined;
    return Math.round(n);
  }, z.number().int().positive().nullable().optional()),
});

// Vocabulary validation — tolerant of empty readings / odd JLPT values
export const vocabularySchema = z.object({
  word: z.string().min(1).max(100).transform((s) => s.trim()),
  reading: z.preprocess((v) => {
    if (typeof v !== "string") return "—";
    const t = v.trim();
    return t.length > 0 ? t : "—";
  }, z.string().min(1).max(100)),
  meanings: z.preprocess((v) => {
    const arr = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    return arr.length > 0 ? arr : ["(unspecified)"];
  }, z.array(z.string()).min(1)),
  partOfSpeech: z.preprocess((v) => {
    if (v === null || v === undefined || v === "") return undefined;
    return typeof v === "string" ? v.slice(0, 50) : undefined;
  }, z.string().max(50).nullable().optional()),
  jlptLevel: jlptLevelField,
});

/** Optional free-text field: trims, converts null/empty/non-string to undefined. */
function optionalTextField(maxLen: number) {
  return z.preprocess((v) => {
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    return t.length > 0 ? t.slice(0, maxLen) : undefined;
  }, z.string().max(maxLen).nullable().optional());
}

// Grammar pattern validation — tolerant like kanji/vocab. Only the pattern
// itself is required; every descriptive field degrades gracefully.
export const grammarPatternSchema = z.object({
  pattern: z.string().min(1).max(100).transform((s) => s.trim()),
  label: optionalTextField(200),
  structure: optionalTextField(300),
  explanation: optionalTextField(1000),
  register: optionalTextField(200),
  nuance: optionalTextField(1000),
  jlptLevel: jlptLevelField,
  examples: z.preprocess((v) => {
    if (!Array.isArray(v)) return [];
    return v
      .map((e) => {
        if (typeof e !== "object" || e === null) return null;
        const japanese = typeof (e as { japanese?: unknown }).japanese === "string"
          ? ((e as { japanese: string }).japanese).trim()
          : "";
        if (!japanese) return null;
        const rawEnglish = (e as { english?: unknown }).english;
        const english = typeof rawEnglish === "string" && rawEnglish.trim().length > 0
          ? rawEnglish.trim().slice(0, 500)
          : undefined;
        return { japanese: japanese.slice(0, 500), english };
      })
      .filter((e) => e !== null)
      .slice(0, 6);
  }, z.array(z.object({ japanese: z.string().min(1).max(500), english: z.string().max(500).optional() }))),
});

// Sentence validation - simplified
export const sentenceSchema = z.object({
  japanese: z.string().min(1).max(1000).transform((s) => s.trim()),
  english: z.preprocess((v) => {
    if (v === null || v === undefined || v === "") return undefined;
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    return t.length > 0 ? t.slice(0, 1000) : undefined;
  }, z.string().max(1000).nullable().optional()),
});

// Source image upload validation
export const uploadSchema = z.object({
  imageUrl: z
    .string()
    .url()
    .refine(isAllowedExtractionImageUrl, {
      message: "Image URL must be a valid UploadThing file URL (https://utfs.io/... or https://*.ufs.sh/...)",
    }),
  fileName: z.string().min(1).max(255),
});

// Text input validation
export const textInputSchema = z.object({
  text: z.string().min(1, "Please enter some text").max(20000, "Text is too long (max 20,000 characters)"),
});

// User feedback / report validation. Powers the "Report this issue" button
// on the capture error screen. sourceImageId is optional because some
// failures (upload errors, pre-insert validation) happen before a
// source_images row exists.
export const feedbackSchema = z.object({
  category: z.enum(["extract_failure", "other"]),
  sourceImageId: z.string().uuid().nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
  errorMessage: z.string().max(2000).nullable().optional(),
});

// Review response validation
export const reviewResponseSchema = z.object({
  itemId: z.string().uuid(),
  quality: z.number().int().min(0).max(5), // 0-5 scale for SM-2 algorithm
});

// AI extraction result validation. grammarPatterns defaults to [] so older
// payloads (and older clients mid-deploy) that omit the key still parse.
export const extractionResultSchema = z.object({
  kanji: z.array(kanjiSchema),
  vocabulary: z.array(vocabularySchema),
  sentences: z.array(sentenceSchema),
  grammarPatterns: z.array(grammarPatternSchema).default([]),
});

// Study guide generation request
export const guideGenerateSchema = z.object({
  sourceImageIds: z.array(z.string().uuid()).min(1).max(10),
});

export type KanjiInput = z.infer<typeof kanjiSchema>;
export type VocabularyInput = z.infer<typeof vocabularySchema>;
export type SentenceInput = z.infer<typeof sentenceSchema>;
export type GrammarPatternInput = z.infer<typeof grammarPatternSchema>;
export type UploadInput = z.infer<typeof uploadSchema>;
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;
