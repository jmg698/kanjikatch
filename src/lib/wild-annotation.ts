/**
 * Deterministic word-familiarity classifier for "See It In The Wild" sentences.
 *
 * The AI that generates sentences also labels which words are "targets" vs
 * "contain a target kanji", but it isn't fully reliable — it can (and does)
 * mislabel compounds. To guarantee correctness, we re-classify every word
 * against the user's *actual* study corpus on the server.
 *
 * Rules (in priority order):
 *   1. "studied"  — the word appears verbatim in the user's studied vocabulary
 *                   or, for single-kanji tokens, in the user's studied kanji
 *                   set (reviewCount > 0).
 *   2. "partial"  — the word is NOT studied as-is, but it contains at least
 *                   one kanji from the user's studied kanji set.
 *                   → Learner knows a part, not the whole word.
 *   3. "unknown"  — everything else (pure kana, unrelated compounds,
 *                   punctuation, etc.).
 *
 * "Studied" means the user has reviewed the item at least once. Items that
 * exist in the library but have never been reviewed are treated as unknown —
 * this is the safe default (JAC-15: don't claim the user knows a compound
 * they haven't actually practiced).
 */

export type WordFamiliarity = "studied" | "partial" | "unknown";

export interface StudiedCorpus {
  studiedWords: Set<string>;
  studiedKanji: Set<string>;
}

const KANJI_REGEX = /[\u4E00-\u9FFF\u3400-\u4DBF]/;
const KANJI_REGEX_GLOBAL = /[\u4E00-\u9FFF\u3400-\u4DBF]/g;
const KANA_ONLY_REGEX = /^[\u3040-\u309F\u30A0-\u30FF\u30FC]+$/;
const PUNCTUATION_REGEX = /^[。、！？「」『』（）\s…・ー～()[\]{}'"`,.!?;:\-]+$/;

export function containsKanji(text: string): boolean {
  return KANJI_REGEX.test(text);
}

export function extractKanjiChars(text: string): string[] {
  return text.match(KANJI_REGEX_GLOBAL) ?? [];
}

export function isKanaOnly(text: string): boolean {
  return KANA_ONLY_REGEX.test(text);
}

export function isPunctuation(text: string): boolean {
  return PUNCTUATION_REGEX.test(text);
}

/**
 * Classify a single word against the studied corpus.
 *
 * Pure kana words and punctuation are always "unknown" *unless* the exact
 * string is in studiedWords (covers kana-only vocab entries like ありがとう).
 */
export function classifyWord(text: string, corpus: StudiedCorpus): WordFamiliarity {
  if (!text) return "unknown";
  if (isPunctuation(text)) return "unknown";

  if (corpus.studiedWords.has(text)) return "studied";

  if (text.length === 1 && corpus.studiedKanji.has(text)) return "studied";

  if (!containsKanji(text)) return "unknown";

  const chars = extractKanjiChars(text);
  for (const c of chars) {
    if (corpus.studiedKanji.has(c)) return "partial";
  }

  return "unknown";
}

/**
 * Shape of a word that can be annotated. We accept the existing AI-labelled
 * shape and add/overwrite the authoritative fields. `isTarget` and
 * `containsTarget` are kept for backwards compatibility with stored records
 * and UI that reads them.
 */
export interface AnnotatableWord {
  text: string;
  reading?: string | null;
  meaning?: string | null;
  isTarget?: boolean;
  containsTarget?: boolean;
  familiarity?: WordFamiliarity;
}

export interface AnnotatedWord extends AnnotatableWord {
  familiarity: WordFamiliarity;
  isTarget: boolean;
  containsTarget: boolean;
}

export function annotateWords<T extends AnnotatableWord>(
  words: T[],
  corpus: StudiedCorpus,
): Array<T & AnnotatedWord> {
  return words.map((w) => {
    const familiarity = classifyWord(w.text, corpus);
    return {
      ...w,
      familiarity,
      isTarget: familiarity === "studied",
      containsTarget: familiarity === "partial",
    };
  });
}

/**
 * Re-annotate the `words` payload on a sentence record. Safe to call
 * repeatedly; always overwrites familiarity / isTarget / containsTarget
 * based on the current corpus.
 */
export function annotateSentenceWords(
  rawWords: unknown,
  corpus: StudiedCorpus,
): AnnotatedWord[] {
  if (!Array.isArray(rawWords)) return [];
  const words = rawWords.filter(
    (w): w is AnnotatableWord =>
      typeof w === "object" && w !== null && typeof (w as AnnotatableWord).text === "string",
  );
  return annotateWords(words, corpus);
}
