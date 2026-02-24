import { z } from "zod";

// Kanji validation - now with arrays
export const kanjiSchema = z.object({
  character: z.string().min(1).max(1),
  meanings: z.array(z.string()).min(1), // Array of meanings
  readingsOn: z.array(z.string()).default([]), // Array of on'yomi readings
  readingsKun: z.array(z.string()).default([]), // Array of kun'yomi readings
  jlptLevel: z.number().int().min(1).max(5).nullable().optional(),
  strokeCount: z.number().int().positive().nullable().optional(),
});

// Vocabulary validation - now with arrays
export const vocabularySchema = z.object({
  word: z.string().min(1).max(100),
  reading: z.string().min(1).max(100),
  meanings: z.array(z.string()).min(1), // Array of meanings
  partOfSpeech: z.string().max(50).nullable().optional(),
  jlptLevel: z.number().int().min(1).max(5).nullable().optional(),
});

// Sentence validation - simplified
export const sentenceSchema = z.object({
  japanese: z.string().min(1).max(1000),
  english: z.string().max(1000).nullable().optional(),
});

// Source image upload validation
export const uploadSchema = z.object({
  imageUrl: z.string().url(),
  fileName: z.string().min(1).max(255),
});

// Text input validation
export const textInputSchema = z.object({
  text: z.string().min(1, "Please enter some text").max(20000, "Text is too long (max 20,000 characters)"),
});

// Review response validation
export const reviewResponseSchema = z.object({
  itemId: z.string().uuid(),
  quality: z.number().int().min(0).max(5), // 0-5 scale for SM-2 algorithm
});

// AI extraction result validation
export const extractionResultSchema = z.object({
  kanji: z.array(kanjiSchema),
  vocabulary: z.array(vocabularySchema),
  sentences: z.array(sentenceSchema),
});

export type KanjiInput = z.infer<typeof kanjiSchema>;
export type VocabularyInput = z.infer<typeof vocabularySchema>;
export type SentenceInput = z.infer<typeof sentenceSchema>;
export type UploadInput = z.infer<typeof uploadSchema>;
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;
