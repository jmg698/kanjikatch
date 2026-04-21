import { describe, it, expect } from "vitest";
import {
  classifyWord,
  annotateWords,
  annotateSentenceWords,
  containsKanji,
  extractKanjiChars,
  isKanaOnly,
  type StudiedCorpus,
} from "./wild-annotation";

function corpus(partial: Partial<StudiedCorpus>): StudiedCorpus {
  return {
    studiedWords: partial.studiedWords ?? new Set(),
    studiedKanji: partial.studiedKanji ?? new Set(),
  };
}

describe("containsKanji / extractKanjiChars / isKanaOnly", () => {
  it("detects kanji presence", () => {
    expect(containsKanji("友達")).toBe(true);
    expect(containsKanji("ともだち")).toBe(false);
    expect(containsKanji("！")).toBe(false);
  });

  it("extracts kanji characters", () => {
    expect(extractKanjiChars("友達")).toEqual(["友", "達"]);
    expect(extractKanjiChars("お勉強する")).toEqual(["勉", "強"]);
    expect(extractKanjiChars("ひらがな")).toEqual([]);
  });

  it("detects kana-only tokens", () => {
    expect(isKanaOnly("ともだち")).toBe(true);
    expect(isKanaOnly("カタカナ")).toBe(true);
    expect(isKanaOnly("ありがとう")).toBe(true);
    expect(isKanaOnly("友")).toBe(false);
    expect(isKanaOnly("友達")).toBe(false);
  });
});

describe("classifyWord — the JAC-15 rules", () => {
  it("returns 'studied' when the exact word is in the studied vocab", () => {
    const c = corpus({ studiedWords: new Set(["図書館"]) });
    expect(classifyWord("図書館", c)).toBe("studied");
  });

  it("returns 'studied' when a single-char token is a studied kanji", () => {
    const c = corpus({ studiedKanji: new Set(["友"]) });
    expect(classifyWord("友", c)).toBe("studied");
  });

  it("core JAC-15 case: compound 友達 with only 友 studied is 'partial', not 'studied'", () => {
    const c = corpus({ studiedKanji: new Set(["友"]) });
    expect(classifyWord("友達", c)).toBe("partial");
  });

  it("the compound is 'studied' once the user actually learned it as a word", () => {
    const c = corpus({
      studiedKanji: new Set(["友"]),
      studiedWords: new Set(["友達"]),
    });
    expect(classifyWord("友達", c)).toBe("studied");
  });

  it("a compound with none of its kanji studied is 'unknown'", () => {
    const c = corpus({ studiedKanji: new Set(["友"]) });
    expect(classifyWord("病気", c)).toBe("unknown");
  });

  it("a multi-kanji compound with at least one studied kanji is 'partial'", () => {
    const c = corpus({ studiedKanji: new Set(["学"]) });
    expect(classifyWord("学校", c)).toBe("partial");
    expect(classifyWord("小学校", c)).toBe("partial");
  });

  it("okurigana: mixed kanji+kana word gets 'partial' if the kanji is studied", () => {
    const c = corpus({ studiedKanji: new Set(["勉"]) });
    expect(classifyWord("勉強する", c)).toBe("partial");
  });

  it("pure kana words are 'unknown' unless exactly in studied vocab", () => {
    const c = corpus({ studiedWords: new Set(["ありがとう"]) });
    expect(classifyWord("ありがとう", c)).toBe("studied");
    expect(classifyWord("こんにちは", c)).toBe("unknown");
  });

  it("punctuation is always 'unknown'", () => {
    const c = corpus({
      studiedKanji: new Set(["。"]),
      studiedWords: new Set(["。"]),
    });
    expect(classifyWord("。", c)).toBe("unknown");
    expect(classifyWord("、", c)).toBe("unknown");
  });

  it("empty / whitespace text is 'unknown'", () => {
    expect(classifyWord("", corpus({}))).toBe("unknown");
    expect(classifyWord("   ", corpus({}))).toBe("unknown");
  });

  it("exact-word vocab beats kanji-based partial classification", () => {
    const c = corpus({
      studiedWords: new Set(["友達"]),
      studiedKanji: new Set(["友", "達"]),
    });
    expect(classifyWord("友達", c)).toBe("studied");
  });
});

describe("annotateWords — back-compat flags", () => {
  it("overwrites isTarget/containsTarget based on familiarity, ignoring AI labels", () => {
    const c = corpus({ studiedKanji: new Set(["友"]) });
    const words = [
      // AI mislabelled this as an exact target — we should correct it.
      { text: "友達", reading: "ともだち", meaning: "friend", isTarget: true, containsTarget: false },
      { text: "。", isTarget: false, containsTarget: false },
    ];
    const annotated = annotateWords(words, c);
    expect(annotated[0].familiarity).toBe("partial");
    expect(annotated[0].isTarget).toBe(false);
    expect(annotated[0].containsTarget).toBe(true);
    expect(annotated[1].familiarity).toBe("unknown");
    expect(annotated[1].isTarget).toBe(false);
    expect(annotated[1].containsTarget).toBe(false);
  });

  it("upgrades a word the AI missed (library changed since sentence was saved)", () => {
    const c = corpus({ studiedWords: new Set(["勉強"]) });
    const words = [{ text: "勉強", isTarget: false, containsTarget: false }];
    const annotated = annotateWords(words, c);
    expect(annotated[0].familiarity).toBe("studied");
    expect(annotated[0].isTarget).toBe(true);
    expect(annotated[0].containsTarget).toBe(false);
  });

  it("preserves reading/meaning on annotated words", () => {
    const c = corpus({ studiedKanji: new Set(["友"]) });
    const annotated = annotateWords(
      [{ text: "友達", reading: "ともだち", meaning: "friend" }],
      c,
    );
    expect(annotated[0].reading).toBe("ともだち");
    expect(annotated[0].meaning).toBe("friend");
  });
});

describe("annotateSentenceWords — handles raw jsonb from DB", () => {
  it("defensively filters bad items and classifies valid ones", () => {
    const c = corpus({ studiedKanji: new Set(["友"]) });
    const raw = [
      { text: "友達", reading: "ともだち" },
      null,
      { reading: "missing text" },
      42,
      { text: "と" },
    ];
    const annotated = annotateSentenceWords(raw, c);
    expect(annotated).toHaveLength(2);
    expect(annotated[0].text).toBe("友達");
    expect(annotated[0].familiarity).toBe("partial");
    expect(annotated[1].text).toBe("と");
    expect(annotated[1].familiarity).toBe("unknown");
  });

  it("returns [] for non-array input", () => {
    expect(annotateSentenceWords(null, corpus({}))).toEqual([]);
    expect(annotateSentenceWords("not an array", corpus({}))).toEqual([]);
  });
});
