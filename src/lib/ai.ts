import Anthropic from "@anthropic-ai/sdk";
import { extractionResultSchema, type ExtractionResult } from "./validations";
import { z } from "zod";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const EXTRACTION_PROMPT = `You are a Japanese language learning assistant. Analyze the provided image of handwritten notes or printed Japanese learning material.

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

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mediaType: string }> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  
  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const mediaType = contentType.split(";")[0].trim();
  
  return { base64, mediaType };
}

export async function extractFromImage(imageUrl: string): Promise<ExtractionResult> {
  const { base64, mediaType } = await fetchImageAsBase64(imageUrl);
  
  const response = await anthropic.messages.create({
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
    throw new Error("No valid JSON in AI response");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return extractionResultSchema.parse(parsed);
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
  meaning: string | null;
}

export interface WildSentence {
  japanese: string;
  english: string;
  words: WildSentenceWord[];
  targetItems: string[]; // the text values of target items used in this sentence
}

const wildSentenceWordSchema = z.object({
  text: z.string(),
  reading: z.string().nullable(),
  isTarget: z.boolean(),
  meaning: z.string().nullable(),
});

const wildSentenceSchema = z.object({
  japanese: z.string(),
  english: z.string(),
  words: z.array(wildSentenceWordSchema),
  targetItems: z.array(z.string()),
});

const wildResponseSchema = z.object({
  sentences: z.array(wildSentenceSchema),
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

6. TARGET MARKING: Set isTarget to true ONLY for words that match one of the target items. A target kanji character appearing inside a compound word counts — mark the whole compound as a target if it contains the target kanji.

7. targetItems array: List which target item texts appear in each sentence.

Return ONLY valid JSON:
{
  "sentences": [
    {
      "japanese": "今日は図書館で勉強した。",
      "english": "I studied at the library today.",
      "words": [
        {"text": "今日", "reading": "きょう", "isTarget": false, "meaning": "today"},
        {"text": "は", "reading": null, "isTarget": false, "meaning": null},
        {"text": "図書館", "reading": null, "isTarget": true, "meaning": "library"},
        {"text": "で", "reading": null, "isTarget": false, "meaning": null},
        {"text": "勉強", "reading": null, "isTarget": true, "meaning": "study"},
        {"text": "した", "reading": null, "isTarget": false, "meaning": "to do"},
        {"text": "。", "reading": null, "isTarget": false, "meaning": null}
      ],
      "targetItems": ["図書館", "勉強"]
    }
  ]
}`;

export async function generateWildSentences(targets: WildTargetItem[]): Promise<WildSentence[]> {
  const targetList = targets
    .map((t) => {
      const label = t.type === "kanji" ? "Kanji" : "Vocab";
      const reading = t.reading ? ` (${t.reading})` : "";
      return `- [${label}] ${t.text}${reading} — ${t.meanings.join(", ")}`;
    })
    .join("\n");

  const sentenceCount = targets.length <= 2 ? 3 : Math.min(5, targets.length + 1);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `${WILD_SENTENCE_PROMPT}\n\n---\n\nTARGET ITEMS:\n${targetList}\n\nGenerate ${sentenceCount} sentences.`,
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
  const result = wildResponseSchema.parse(parsed);
  return result.sentences;
}
