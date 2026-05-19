import { promises as fs } from "fs";
import path from "path";
import type { ExtractionResult } from "@/lib/validations";

export interface SampleData {
  slug: string;
  label: string;
  difficultyTag: string;
  imagePath: string;
  kanji: ExtractionResult["kanji"];
  vocabulary: ExtractionResult["vocabulary"];
  sentences: ExtractionResult["sentences"];
  fallbackWildSentence?: {
    japanese: string;
    english: string;
    words: Array<{ text: string; reading?: string; isTarget?: boolean; containsTarget?: boolean }>;
  };
}

const SAMPLE_SLUGS = new Set(["town-news-cat"]);

export function isKnownSample(slug: string): boolean {
  return SAMPLE_SLUGS.has(slug);
}

export async function loadSample(slug: string): Promise<SampleData> {
  if (!isKnownSample(slug)) {
    throw new Error(`Unknown sample: ${slug}`);
  }
  const file = path.join(process.cwd(), "public", "samples", `${slug}.json`);
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw) as SampleData;
}
