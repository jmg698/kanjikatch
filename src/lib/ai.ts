import Anthropic from "@anthropic-ai/sdk";
import {
  extractionResultSchema,
  isAllowedExtractionImageUrl,
  type ExtractionResult,
} from "./validations";
import { z } from "zod";
import { agentDebugLog } from "@/lib/debug-ingest";
import { recordApiUsage, type CostProtectedEndpoint } from "@/lib/cost-protection";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Caller context passed to each AI function so usage can be attributed to a
// user and IP when recorded. Optional everywhere — call sites that don't
// have a request context (scripts, internal warmups) can omit it.
export interface AiUsageContext {
  userId: string | null;
  ipHash: string | null;
  endpoint: CostProtectedEndpoint;
}

function reportUsage(
  ctx: AiUsageContext | undefined,
  model: string,
  usage: { input_tokens?: number; output_tokens?: number } | undefined,
): void {
  if (!ctx) return;
  // Fire-and-forget — recordApiUsage swallows its own errors.
  void recordApiUsage({
    userId: ctx.userId,
    ipHash: ctx.ipHash,
    endpoint: ctx.endpoint,
    model,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
  });
}

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

4. **Grammar Patterns**: Grammar points the material is teaching or using deliberately. Look for conjugation rules, sentence patterns, particles-as-topic (e.g. 〜という, 〜くなります, 〜てから), register ladders (が／けれども／けど), and set idioms (e.g. 頭が回らない). For each:
   - pattern: The canonical Japanese form, e.g. "〜という" or "〜くなります"
   - label: A short English handle, e.g. "B called A"
   - structure: The formation rule, e.g. "Noun A + という + Noun B"
   - explanation: 1-3 plain-English sentences on what it means and when to use it
   - register: Formality/usage note if relevant (e.g. "casual speech"), else null
   - nuance: Contrasts, pitfalls, or common-mistake warnings if relevant (e.g. "the particle is と, never の"), else null
   - jlptLevel: Approximate JLPT level 1-5 if known
   - examples: 1-3 example usages as { japanese, english }, taken from the material where possible

   Only extract grammar the material actually teaches or prominently uses — do not list every particle in every sentence. A vocabulary list slide typically has zero grammar patterns; a slide titled with a pattern typically has one or two. Conjugated forms of ordinary verbs are vocabulary, not grammar patterns.

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
  ],
  "grammarPatterns": [
    {
      "pattern": "〜という",
      "label": "B called A",
      "structure": "Noun A + という + Noun B",
      "explanation": "Introduces the name of something the listener probably doesn't know.",
      "register": null,
      "nuance": "The particle is と — never からいう or のいう.",
      "jlptLevel": 4,
      "examples": [
        {
          "japanese": "さくらというレストランを知っていますか。",
          "english": "Do you know a restaurant called Sakura?"
        }
      ]
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

const EXTRACTION_MODEL = "claude-sonnet-4-6";

export async function extractFromImage(
  imageUrl: string,
  usageContext?: AiUsageContext,
): Promise<ExtractionResult> {
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
      model: EXTRACTION_MODEL,
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

  reportUsage(usageContext, EXTRACTION_MODEL, response.usage);
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

4. **Grammar Patterns**: Grammar points the material is teaching or deliberately using (sentence patterns, conjugation rules, register contrasts, set idioms) with:
   - pattern: Canonical Japanese form, e.g. "〜という"
   - label: Short English handle, e.g. "B called A"
   - structure: Formation rule, e.g. "Noun A + という + Noun B"
   - explanation: 1-3 plain-English sentences on meaning and usage
   - register: Formality/usage note if relevant, else null
   - nuance: Contrasts, pitfalls, or warnings if relevant, else null
   - jlptLevel: Approximate JLPT level 1-5 if known
   - examples: 1-3 example usages as { japanese, english }, from the material where possible

   Only extract grammar the material actually teaches or prominently uses — not every particle in every sentence. Conjugated forms of ordinary verbs are vocabulary, not grammar patterns.

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
  ],
  "grammarPatterns": [
    {
      "pattern": "〜という",
      "label": "B called A",
      "structure": "Noun A + という + Noun B",
      "explanation": "Introduces the name of something the listener probably doesn't know.",
      "register": null,
      "nuance": "The particle is と — never からいう or のいう.",
      "jlptLevel": 4,
      "examples": [
        {
          "japanese": "さくらというレストランを知っていますか。",
          "english": "Do you know a restaurant called Sakura?"
        }
      ]
    }
  ]
}

If a category has no items, return an empty array for that category.`;

export async function extractFromText(
  text: string,
  usageContext?: AiUsageContext,
): Promise<ExtractionResult> {
  const response = await anthropic.messages.create({
    model: EXTRACTION_MODEL,
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

  reportUsage(usageContext, EXTRACTION_MODEL, response.usage);
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

const WILD_SENTENCE_MODEL = "claude-sonnet-4-6";

export async function generateWildSentences(
  targets: WildTargetItem[],
  difficultyProfile?: DifficultyProfile,
  usageContext?: AiUsageContext,
): Promise<WildSentence[]> {
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

  // The static WILD_SENTENCE_PROMPT lives in `system` with cache_control so
  // Anthropic caches the prefix on the first call. Subsequent calls within
  // the cache TTL (~5 min) skip re-processing those tokens, which cuts both
  // latency and cost for back-to-back interludes / closer generations.
  // SDK 0.32.x exposes prompt caching under the `beta.promptCaching` namespace.
  const userContent = `${difficultyGuidance}\n\n---\n\nTARGET ITEMS:\n${targetList}\n\nGenerate ${sentenceCount} sentences.`.trimStart();

  const response = await anthropic.beta.promptCaching.messages.create({
    model: WILD_SENTENCE_MODEL,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: WILD_SENTENCE_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: userContent,
      },
    ],
  });

  reportUsage(usageContext, WILD_SENTENCE_MODEL, response.usage);

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

// --- Study guide generation ---

export interface StudyGuideKanjiInput {
  character: string;
  readingsOn: string[];
  readingsKun: string[];
  meanings: string[];
  jlptLevel: number | null;
}

export interface StudyGuideVocabInput {
  word: string;
  reading: string;
  meanings: string[];
  partOfSpeech: string | null;
  jlptLevel: number | null;
}

export interface StudyGuideSentenceInput {
  japanese: string;
  english: string | null;
}

export interface StudyGuideGrammarInput {
  pattern: string;
  label: string | null;
  structure: string | null;
  explanation: string | null;
  register: string | null;
  nuance: string | null;
  jlptLevel: number | null;
  examples: { japanese: string; english?: string | null }[];
}

export interface StudyGuideInput {
  sourceNames: string[];
  kanji: StudyGuideKanjiInput[];
  vocabulary: StudyGuideVocabInput[];
  sentences: StudyGuideSentenceInput[];
  grammarPatterns: StudyGuideGrammarInput[];
}

// Input caps keep a pathological multi-source request from blowing up the
// prompt. Generous enough that a week of class slides fits comfortably.
const GUIDE_INPUT_CAPS = {
  kanji: 60,
  vocabulary: 120,
  sentences: 40,
  grammarPatterns: 12,
} as const;

const STUDY_GUIDE_PROMPT = `You are a Japanese teacher writing a study guide for one intermediate learner, built ONLY from the material they captured from their class (vocabulary, kanji, sentences, and grammar patterns provided below). The guide's job is to take them past flashcards: connect the items into patterns, explain nuance, and make them produce Japanese — the way a great tutor's handout would.

FORMAT — GitHub-flavored markdown, following EXACTLY this skeleton:

- Line 1: "# " + a short title naming the lesson's main patterns or theme (e.g. "# Japanese Study Guide: 〜という・過ごす"). Then an italic line crediting the source material by name.
- "## PART 1 — VOCABULARY": one or more tables with header "| Kanji | Kana | English |". Group into small thematic tables with "### " subheadings when the vocabulary clusters naturally; otherwise one table. Use "—" in the Kana column for kana-only/katakana words. After a table, add a short bold "**Note:**" line ONLY when an item carries real nuance worth flagging (politeness, danger of misuse, easily-confused pairs).
- "## PART 2 — GRAMMAR PATTERNS": one "### " section per provided grammar pattern, numbered ①②③…, formatted as: heading with pattern + short English handle; a "**Structure:**" line if a formation rule applies; 1-3 sentences of plain-English explanation; 2-3 example sentences. EVERY example is three consecutive lines: the sentence with kanji, the same sentence in all-kana, then the English in italics. Prefer examples from the provided sentences; write natural new ones using the provided vocabulary when needed. Add a "⚠️" warning line for common mistakes where the material suggests one. If patterns contrast with each other (register ladders, similar adverbs), add a comparison table.
- "## PART 3 — KANJI STUDY": group the provided kanji by JLPT level (N5 table, N4 table, "Above N4 — recognize, don't stress" table), each with columns "| Kanji | Readings | Meaning | Example words |" where example words come from the provided vocabulary when possible (word + kana + gloss). If levels are missing, group sensibly and say so. End with ONE "### Kanji tip:" callout teaching a genuinely useful reading or component insight drawn from these kanji (e.g. on/kun reading split in compounds).
- "## PART 4 — PRACTICE": three exercise sets that use ONLY the lesson's vocabulary and grammar: "### A." fill-in-the-blank (5 items, blanks written as ＿＿＿), "### B." translate English → Japanese (5 items), "### C." personal questions the learner answers about their own life (3 items, in Japanese). Then "### Answer key (A)" and "### Answer key (B)" as numbered lists. No answer key for C.
- Separate every PART with "---" on its own line.

RULES:
- Build strictly from the provided material. You may add readings, kana renderings, JLPT levels, and glosses from your knowledge of Japanese, and write practice sentences that recombine the provided items — but do NOT introduce unrelated new vocabulary lists or grammar the material doesn't contain.
- If a category is empty (e.g. no grammar patterns), omit that PART entirely and renumber the remaining parts.
- Keep explanations warm, concrete, and aimed at an intermediate learner (JLPT N4-ish). Short sentences. No filler.
- All Japanese must be correct and natural. Double-check kana lines match their kanji lines exactly.
- Output ONLY the markdown document. No preamble, no code fences around the whole document, no closing remarks.`;

const STUDY_GUIDE_MODEL = "claude-sonnet-4-6";

/** First "# " heading of the guide, stripped of markdown emphasis — used as the stored title. */
export function parseGuideTitle(markdown: string): string | null {
  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      const title = trimmed.slice(2).replace(/[*_`#]/g, "").trim();
      return title.length > 0 ? title.slice(0, 200) : null;
    }
    // Stop scanning once real content starts without a title heading.
    if (trimmed.length > 0 && !trimmed.startsWith("#")) break;
  }
  return null;
}

function formatGuideMaterial(input: StudyGuideInput): string {
  const lines: string[] = [];

  lines.push(`SOURCE MATERIAL: ${input.sourceNames.join(" / ") || "captured notes"}`);

  const grammar = input.grammarPatterns.slice(0, GUIDE_INPUT_CAPS.grammarPatterns);
  if (grammar.length > 0) {
    lines.push("", "GRAMMAR PATTERNS:");
    for (const g of grammar) {
      const parts = [`- ${g.pattern}`];
      if (g.label) parts.push(`(${g.label})`);
      if (g.structure) parts.push(`| structure: ${g.structure}`);
      if (g.explanation) parts.push(`| meaning: ${g.explanation}`);
      if (g.register) parts.push(`| register: ${g.register}`);
      if (g.nuance) parts.push(`| nuance: ${g.nuance}`);
      if (g.jlptLevel) parts.push(`| N${g.jlptLevel}`);
      lines.push(parts.join(" "));
      for (const ex of g.examples.slice(0, 3)) {
        lines.push(`  example: ${ex.japanese}${ex.english ? ` — ${ex.english}` : ""}`);
      }
    }
  }

  const vocab = input.vocabulary.slice(0, GUIDE_INPUT_CAPS.vocabulary);
  if (vocab.length > 0) {
    lines.push("", "VOCABULARY:");
    for (const v of vocab) {
      lines.push(
        `- ${v.word} (${v.reading}) — ${v.meanings.join(", ")}${v.partOfSpeech ? ` [${v.partOfSpeech}]` : ""}${v.jlptLevel ? ` [N${v.jlptLevel}]` : ""}`,
      );
    }
  }

  const kanjiItems = input.kanji.slice(0, GUIDE_INPUT_CAPS.kanji);
  if (kanjiItems.length > 0) {
    lines.push("", "KANJI:");
    for (const k of kanjiItems) {
      const readings = [...k.readingsOn, ...k.readingsKun].join("・") || "—";
      lines.push(
        `- ${k.character} (${readings}) — ${k.meanings.join(", ")}${k.jlptLevel ? ` [N${k.jlptLevel}]` : ""}`,
      );
    }
  }

  const sentences = input.sentences.slice(0, GUIDE_INPUT_CAPS.sentences);
  if (sentences.length > 0) {
    lines.push("", "SENTENCES:");
    for (const s of sentences) {
      lines.push(`- ${s.japanese}${s.english ? ` — ${s.english}` : ""}`);
    }
  }

  return lines.join("\n");
}

export async function generateStudyGuide(
  input: StudyGuideInput,
  usageContext?: AiUsageContext,
): Promise<{ title: string; markdown: string; model: string }> {
  const material = formatGuideMaterial(input);

  const response = await anthropic.messages.create({
    model: STUDY_GUIDE_MODEL,
    max_tokens: 8192,
    system: STUDY_GUIDE_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here is the captured material to build the study guide from:\n\n${material}`,
      },
    ],
  });

  reportUsage(usageContext, STUDY_GUIDE_MODEL, response.usage);

  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from AI");
  }

  // Strip an accidental full-document code fence if the model added one.
  let markdown = textContent.text.trim();
  const fenceMatch = markdown.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/);
  if (fenceMatch) {
    markdown = fenceMatch[1].trim();
  }

  if (markdown.length < 100) {
    throw new Error("Study guide response was unexpectedly short");
  }

  const title = parseGuideTitle(markdown) ?? `Study Guide — ${input.sourceNames[0] ?? "captured notes"}`;

  return { title, markdown, model: STUDY_GUIDE_MODEL };
}
