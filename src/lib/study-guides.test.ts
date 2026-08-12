import { describe, it, expect, beforeAll } from "vitest";
import { grammarPatternSchema, extractionResultSchema } from "./validations";

// ai.ts instantiates the Anthropic client at module load (and transitively
// the Neon client via cost-protection), both of which throw without env
// values — so stub them and import dynamically.
let parseGuideTitle: typeof import("./ai").parseGuideTitle;
beforeAll(async () => {
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test-key";
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || "postgres://test:test@localhost:5432/test";
  ({ parseGuideTitle } = await import("./ai"));
});

describe("grammarPatternSchema", () => {
  it("accepts a full pattern", () => {
    const result = grammarPatternSchema.parse({
      pattern: "〜という",
      label: "B called A",
      structure: "Noun A + という + Noun B",
      explanation: "Introduces the name of something the listener may not know.",
      register: null,
      nuance: "The particle is と, never の.",
      jlptLevel: "N4",
      examples: [
        { japanese: "さくらというレストランを知っていますか。", english: "Do you know a restaurant called Sakura?" },
      ],
    });
    expect(result.pattern).toBe("〜という");
    expect(result.jlptLevel).toBe(4);
    expect(result.examples).toHaveLength(1);
    expect(result.register).toBeUndefined();
  });

  it("tolerates missing/malformed optional fields", () => {
    const result = grammarPatternSchema.parse({ pattern: "  〜くなります  " });
    expect(result.pattern).toBe("〜くなります");
    expect(result.examples).toEqual([]);
    expect(result.explanation).toBeUndefined();
  });

  it("drops malformed examples and caps at 6", () => {
    const result = grammarPatternSchema.parse({
      pattern: "〜くて",
      examples: [
        { japanese: "暑くて、頭が回りません。" },
        { japanese: "" },
        { notJapanese: true },
        null,
        ...Array.from({ length: 8 }, (_, i) => ({ japanese: `例文${i}。` })),
      ],
    });
    expect(result.examples.length).toBe(6);
    expect(result.examples[0].japanese).toBe("暑くて、頭が回りません。");
  });

  it("rejects a missing pattern", () => {
    expect(grammarPatternSchema.safeParse({ explanation: "no pattern" }).success).toBe(false);
  });
});

describe("extractionResultSchema with grammarPatterns", () => {
  it("defaults grammarPatterns to [] for legacy payloads", () => {
    const result = extractionResultSchema.parse({
      kanji: [],
      vocabulary: [],
      sentences: [],
    });
    expect(result.grammarPatterns).toEqual([]);
  });

  it("parses grammarPatterns when present", () => {
    const result = extractionResultSchema.parse({
      kanji: [],
      vocabulary: [],
      sentences: [],
      grammarPatterns: [{ pattern: "〜とくらべて" }],
    });
    expect(result.grammarPatterns).toHaveLength(1);
  });
});

describe("parseGuideTitle", () => {
  it("extracts the first h1", () => {
    expect(parseGuideTitle("# Japanese Study Guide: 〜という\n*Based on class slides*\n\n## PART 1"))
      .toBe("Japanese Study Guide: 〜という");
  });

  it("strips markdown emphasis from the title", () => {
    expect(parseGuideTitle("# **Study Guide** — _August_\ncontent")).toBe("Study Guide — August");
  });

  it("returns null when content starts without a heading", () => {
    expect(parseGuideTitle("Just some text\n# Late heading")).toBeNull();
  });

  it("skips leading blank lines", () => {
    expect(parseGuideTitle("\n\n# Title\nbody")).toBe("Title");
  });
});
