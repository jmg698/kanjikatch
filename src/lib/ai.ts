import Anthropic from "@anthropic-ai/sdk";
import { extractionResultSchema, type ExtractionResult } from "./validations";

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
