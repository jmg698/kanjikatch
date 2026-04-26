import Anthropic from "@anthropic-ai/sdk";
import {
  extractionResultSchema,
  isAllowedExtractionImageUrl,
  type ExtractionResult,
} from "./validations";
import { z } from "zod";
import { agentDebugLog } from "@/lib/debug-ingest";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const EXTRACTION_PROMPT = `You are a Japanese language extraction assistant. Your job is to find every piece of Japanese language content in an image and return structured data.

IMPORTANT CONTEXT: The images you receive are typically handwritten study notes from an English-speaking Japanese learner. These notes commonly mix:
- Kanji and kana (hiragana/katakana)
- Romaji phonetic annotations (e.g. "taberu" next to 食べる)
- English translations or glosses (e.g. "to eat" written near a word)
- Arrows, brackets, underlines, or other markings connecting related info
- Vocabulary lists, grammar notes, practice sentences
- Messy or informal handwriting in varying sizes

Use ALL visible context (romaji, English glosses, annotations) as clues to identify and enrich the Japanese items. For example, if you see "犬 = inu = dog", extract kanji 犬 with meaning ["dog"] and kun reading ["いぬ"], using the romaji and English as supporting evidence.

EXTRACTION RULES:
- Extract ALL Japanese content visible in the image. Prefer over-extracting to missing items — the user would rather review a few extra items than miss content.
- If handwriting is ambiguous but you can make a reasonable guess, include it. If a kanji is partially obscured or cut off, include your best guess.
- Use your knowledge of Japanese to fill in readings, meanings, JLPT levels, and stroke counts even if they are not explicitly written in the notes.
- Romaji and English text should NOT be extracted as standalone items — they are context for the Japanese items they annotate.
- For each kanji character that appears, extract it individually even if it also appears inside a vocabulary compound.

Extract the following and return as valid JSON:

1. **Kanji**: Individual kanji characters with:
   - character: The single kanji character
   - meanings: Array of English meanings
   - readingsOn: Array of on'yomi readings in katakana
   - readingsKun: Array of kun'yomi readings in hiragana
   - jlptLevel: JLPT level 1-5 if known (5=N5 easiest, 1=N1 hardest)
   - strokeCount: Number of strokes if known

2. **Vocabulary**: Words or compounds (2+ characters, or kana-only words) with:
   - word: The word in Japanese script
   - reading: Full hiragana reading
   - meanings: Array of English meanings
   - partOfSpeech: Part of speech (noun, verb, adjective, adverb, etc.)
   - jlptLevel: JLPT level if known

3. **Sentences**: Any complete or near-complete Japanese sentences with:
   - japanese: The sentence in Japanese
   - english: English translation if visible or inferrable

Return ONLY valid JSON in this exact format:
{
  "kanji": [
    {
      "character": "食",
      "meanings": ["eat", "food"],
      "readingsOn": ["ショク"],
      "readingsKun": ["た.べる", "く.う"],
      "jlptLevel": 5,
      "strokeCount": 9
    }
  ],
  "vocabulary": [
    {
      "word": "食べる",
      "reading": "たべる",
      "meanings": ["to eat"],
      "partOfSpeech": "verb",
      "jlptLevel": 5
    }
  ],
  "sentences": [
    {
      "japanese": "毎日ご飯を食べます。",
      "english": "I eat rice every day."
    }
  ]
}

If a category has no items, return an empty array for that category.`;

const ANTHROPIC_IMAGE_MEDIA = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function sniffImageMediaType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  return "image/jpeg";
}

function guessMediaTypeFromUrl(urlString: string): string | undefined {
  const path = urlString.split("?")[0].toLowerCase();
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  return undefined;
}

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mediaType: string }> {
  if (!isAllowedExtractionImageUrl(url)) {
    throw new Error("Refusing to fetch image: URL host is not allowed");
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const headerType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  let mediaType = headerType;
  if (!ANTHROPIC_IMAGE_MEDIA.has(mediaType)) {
    const fromUrl = guessMediaTypeFromUrl(url);
    if (fromUrl && ANTHROPIC_IMAGE_MEDIA.has(fromUrl)) {
      mediaType = fromUrl;
    } else {
      mediaType = sniffImageMediaType(bytes);
    }
  }

  // #region agent log
  agentDebugLog("H2", "ai.ts:fetchImageAsBase64", "image_ready", {
    mediaType,
    byteLength: bytes.length,
    base64Len: base64.length,
  });
  // #endregion

  return { base64, mediaType };
}

export async function extractFromImage(imageUrl: string): Promise<ExtractionResult> {
  let host = "invalid";
  try {
    host = new URL(imageUrl).hostname;
  } catch {
    host = "invalid-url";
  }
  // #region agent log
  agentDebugLog("H2", "ai.ts:extractFromImage", "start", {
    host,
    hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY?.length),
  });
  // #endregion

  const { base64, mediaType } = await fetchImageAsBase64(imageUrl);

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: base64,
              },
            },
            {
              type: "text",
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });
  } catch (e) {
    // #region agent log
    agentDebugLog("H3", "ai.ts:extractFromImage", "anthropic_messages_create_failed", {
      name: e instanceof Error ? e.name : "unknown",
      msgPrefix: e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300),
    });
    // #endregion
    throw e;
  }

  // #region agent log
  const blockTypes = response.content.map((b) => b.type);
  agentDebugLog("H3", "ai.ts:extractFromImage", "anthropic_ok", { blockTypes });
  // #endregion

  return parseExtractionResponse(response);
}

const TEXT_EXTRACTION_PROMPT = `You are a Japanese language learning assistant. Analyze the provided text containing Japanese learning notes or materials.

Extract the following information and return it as valid JSON:

1. **Kanji**: Individual kanji characters with:
   - character: The kanji character itself
   - meanings: Array of English meanings (e.g., ["study", "learning"])
   - readingsOn: Array of on'yomi readings in katakana (e.g., ["ガク", "ガッ"])
   - readingsKun: Array of kun'yomi readings in hiragana (e.g., ["まな.ぶ"])
   - jlptLevel: JLPT level 1-5 if known (5=N5, 1=N1)
   - strokeCount: Number of strokes if known

2. **Vocabulary**: Words/compounds with:
   - word: The word in Japanese
   - reading: Hiragana reading of the full word
   - meanings: Array of English meanings (e.g., ["student", "pupil"])
   - partOfSpeech: Part of speech (noun, verb, adjective, etc.)
   - jlptLevel: JLPT level if known

3. **Sentences**: Complete sentences with:
   - japanese: The sentence in Japanese
   - english: English translation (optional)

Return ONLY valid JSON in this exact format:
{
  "kanji": [
    {
      "character": "学",
      "meanings": ["study", "learning"],
      "readingsOn": ["ガク", "ガッ"],
      "readingsKun": ["まな.ぶ"],
      "jlptLevel": 5,
      "strokeCount": 8
    }
  ],
  "vocabulary": [
    {
      "word": "学生",
      "reading": "がくせい",
      "meanings": ["student", "pupil"],
      "partOfSpeech": "noun",
      "jlptLevel": 5
    }
  ],
  "sentences": [
    {
      "japanese": "学生です。",
      "english": "I am a student."
    }
  ]
}

If a category has no items, return an empty array for that category.`;

export async function extractFromText(text: string): Promise<ExtractionResult> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `${TEXT_EXTRACTION_PROMPT}\n\n---\n\nHere is the text to analyze:\n\n${text}`,
          },
        ],
      },
    ],
  });

  return parseExtractionResponse(response);
}

function parseExtractionResponse(response: Anthropic.Message): ExtractionResult {
  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from AI");
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    // #region agent log
    agentDebugLog("H4", "ai.ts:parseExtractionResponse", "no_json_match", {
      textLen: textContent.text.length,
      textPrefix: textContent.text.slice(0, 120),
    });
    // #endregion
    throw new Error("No valid JSON in AI response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    // #region agent log
    agentDebugLog("H4", "ai.ts:parseExtractionResponse", "json_parse_threw", {
      msgPrefix: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200),
    });
    // #endregion
    throw e;
  }

  // #region agent log
  agentDebugLog("H4", "ai.ts:parseExtractionResponse", "json_parsed", {
    topKeys: typeof parsed === "object" && parsed !== null ? Object.keys(parsed as object) : [],
  });
  // #endregion

  const parsedResult = extractionResultSchema.safeParse(parsed);
  if (!parsedResult.success) {
    const detail = parsedResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    // #region agent log
    agentDebugLog("H4", "ai.ts:parseExtractionResponse", "schema_safeParse_failed", {
      issueCount: parsedResult.error.issues.length,
      detailPrefix: detail.slice(0, 400),
    });
    // #endregion
    throw new Error(`Invalid extraction JSON: ${detail}`);
  }
  return parsedResult.data;
}

// --- "See It In The Wild" sentence generation ---

export interface WildTargetItem {
  id: string;
  type: "kanji" | "vocab";
  text: string; // the character or word
  meanings: string[];
  reading?: string;
}

export interface WildSentenceWord {
  text: string;
  reading: string | null;
  isTarget: boolean;
  containsTarget: boolean;
  meaning: string | null;
}

export interface WildSentence {
  japanese: string;
  english: string;
  words: WildSentenceWord[];
  targetItems: string[]; // the text values of target items used in this sentence
}

const wildSentenceWordSchema = z.object({
  text: z.string().min(1),
  reading: z.preprocess((v) => (v === undefined ? null : v), z.union([z.string(), z.null()])),
  isTarget: z.preprocess((v) => v === true || v === 1 || v === "true", z.boolean()),
  containsTarget: z.preprocess((v) => v === true || v === 1 || v === "true", z.boolean()),
  meaning: z.preprocess((v) => (v === undefined ? null : v), z.union([z.string(), z.null()])),
});

const wildSentenceSchema = z.object({
  japanese: z.string().min(1),
  english: z.preprocess((v) => (typeof v === "string" ? v : ""), z.string()),
  words: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(wildSentenceWordSchema)),
  targetItems: z.preprocess((v) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []), z.array(z.string())),
});

const wildResponseSchema = z.object({
  sentences: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(wildSentenceSchema)),
});

const WILD_SENTENCE_PROMPT = `You are a Japanese language tutor creating natural, contextual sentences for a learner. Your goal: show how specific kanji and vocabulary appear in real Japanese — daily life, simple news, conversations, social media, signs, announcements.

You will be given a list of TARGET items (kanji or vocabulary) the learner just reviewed. Generate 3-5 natural Japanese sentences that incorporate these items. Follow these rules carefully:

1. NATURAL LANGUAGE: Write sentences a Japanese person would actually say, read, or write. Vary registers — casual speech, polite speech, written/formal. No textbook drills like "X means Y" or "Please use X."

2. SENTENCE VARIETY: Mix short and long sentences. Use different grammatical patterns. Some can be standalone thoughts, others dialogue, others from signs/announcements/articles.

3. FURIGANA RULES — CRITICAL:
   - For NON-target kanji: provide the reading in the "reading" field (this becomes furigana so the learner can read the full sentence)
   - For TARGET items: set reading to null (the learner should recognize these)
   - For hiragana/katakana-only words: reading is null
   - For particles and punctuation: reading is null

4. MEANING FIELD — for each word:
   - For content words (nouns, verbs, adjectives, adverbs, i-adjectives, na-adjectives): provide a concise English meaning (1-3 words)
   - For particles, punctuation, and purely grammatical words: set meaning to null
   - For verbs, use the dictionary form meaning (e.g. "to study", "to eat")

5. WORD SEGMENTATION: Break the sentence into natural word boundaries. Each token in the "words" array is one word/particle/punctuation. Don't merge separate words, don't split single kanji compounds.

6. TARGET MARKING — CRITICAL DISTINCTION (NOTE: the server re-verifies these flags against the learner's actual study history, so be accurate but not anxious):
   - isTarget = true: ONLY for words that EXACTLY match a target item text. If the target is a single kanji like 友, only mark 友 as a target if it appears as a standalone word. NEVER mark a compound (e.g. 友達) as a target just because it contains a target kanji — the learner may not know the full compound.
   - containsTarget = true: For compound or multi-character words that CONTAIN a target kanji but are NOT themselves an exact target match. These MUST include a reading (furigana) and a concise meaning, because the learner may not recognize the whole compound.
   - Both default to false for regular words, particles, and punctuation.

7. targetItems array: List which target item texts appear in each sentence (both exact matches and as parts of compounds).

Return ONLY valid JSON:
{
  "sentences": [
    {
      "japanese": "友達と図書館で勉強した。",
      "english": "I studied at the library with a friend.",
      "words": [
        {"text": "友達", "reading": "ともだち", "isTarget": false, "containsTarget": true, "meaning": "friend"},
        {"text": "と", "reading": null, "isTarget": false, "containsTarget": false, "meaning": null},
        {"text": "図書館", "reading": null, "isTarget": true, "containsTarget": false, "meaning": "library"},
        {"text": "で", "reading": null, "isTarget": false, "containsTarget": false, "meaning": null},
        {"text": "勉強", "reading": null, "isTarget": true, "containsTarget": false, "meaning": "study"},
        {"text": "した", "reading": null, "isTarget": false, "containsTarget": false, "meaning": "to do"},
        {"text": "。", "reading": null, "isTarget": false, "containsTarget": false, "meaning": null}
      ],
      "targetItems": ["友", "図書館", "勉強"]
    }
  ]
}`;

export interface DifficultyProfile {
  tooEasyPct: number;
  justRightPct: number;
  tooHardPct: number;
  totalRated: number;
}

function buildDifficultyGuidance(profile: DifficultyProfile): string {
  if (profile.totalRated < 5) return "";

  const lines: string[] = [];

  lines.push(`\n\nLEARNER DIFFICULTY CALIBRATION (based on ${profile.totalRated} recent ratings):`);
  lines.push(`- ${profile.tooEasyPct}% rated "Too Easy", ${profile.justRightPct}% rated "Just Right", ${profile.tooHardPct}% rated "Too Hard"`);

  if (profile.tooHardPct >= 50) {
    lines.push(
      "The learner finds most sentences TOO CHALLENGING. Adjust accordingly:",
      "- Use shorter sentences (8-15 words max)",
      "- Prefer common, everyday grammar (です/ます form, simple て-form, basic adjectives)",
      "- Limit each sentence to 1-2 unfamiliar non-target words",
      "- Favor concrete, daily-life topics (food, weather, routine, shopping)",
      "- Avoid literary expressions, complex subordinate clauses, and rare vocabulary",
    );
  } else if (profile.tooHardPct >= 35) {
    lines.push(
      "The learner finds sentences somewhat challenging. Lean simpler:",
      "- Keep sentences moderate length (10-20 words)",
      "- Mix simple and intermediate grammar, but avoid advanced patterns",
      "- Limit unfamiliar non-target words to 2-3 per sentence",
    );
  } else if (profile.tooEasyPct >= 50) {
    lines.push(
      "The learner finds most sentences TOO EASY. Increase the challenge:",
      "- Use longer, more complex sentences with subordinate clauses",
      "- Include intermediate-to-advanced grammar (conditionals, passive, causative, nominalization)",
      "- Include 3-4 non-target words the learner may not know",
      "- Use varied registers — news headlines, formal writing, casual speech",
    );
  } else if (profile.tooEasyPct >= 35) {
    lines.push(
      "The learner finds sentences somewhat easy. Nudge the difficulty up:",
      "- Use slightly longer sentences with more varied grammar",
      "- Include 2-3 non-target words that may be new",
    );
  }

  return lines.join("\n");
}

export async function generateWildSentences(targets: WildTargetItem[], difficultyProfile?: DifficultyProfile): Promise<WildSentence[]> {
  const targetList = targets
    .map((t) => {
      const label = t.type === "kanji" ? "Kanji" : "Vocab";
      const reading = t.reading ? ` (${t.reading})` : "";
      return `- [${label}] ${t.text}${reading} — ${t.meanings.join(", ")}`;
    })
    .join("\n");

  const sentenceCount = targets.length <= 2 ? 3 : Math.min(5, targets.length + 1);

  const difficultyGuidance = difficultyProfile
    ? buildDifficultyGuidance(difficultyProfile)
    : "";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `${WILD_SENTENCE_PROMPT}${difficultyGuidance}\n\n---\n\nTARGET ITEMS:\n${targetList}\n\nGenerate ${sentenceCount} sentences.`,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from AI");
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No valid JSON in AI response");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const result = wildResponseSchema.safeParse(parsed);
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid sentence JSON from model: ${detail}`);
  }
  return result.data.sentences;
}
