"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Plus, Check, Loader2, Zap, ThumbsUp, TrendingUp, Info } from "lucide-react";
import type { WildSentenceData, WildWord, WordFamiliarity } from "./in-the-wild";

export type DifficultyRating = "too_easy" | "just_right" | "too_hard";

interface SentenceDisplayProps {
  sentence: WildSentenceData;
  showAddWord?: boolean;
  compact?: boolean;
  showLegend?: boolean;
  onRate?: (sentenceId: string, rating: DifficultyRating) => void;
  currentRating?: DifficultyRating | null;
}

/**
 * Derive the authoritative familiarity for a word, with a fallback for
 * older stored records that predate JAC-15 (these only have isTarget /
 * containsTarget booleans).
 */
function resolveFamiliarity(word: WildWord): WordFamiliarity {
  if (word.familiarity) return word.familiarity;
  if (word.isTarget) return "studied";
  if (word.containsTarget) return "partial";
  return "unknown";
}

function WordToken({ word, onTapWord }: { word: WildWord; onTapWord?: (word: WildWord) => void }) {
  const isPunctuation = /^[。、！？「」『』（）\s…・ー～]+$/.test(word.text);

  if (isPunctuation) {
    return <span className="wild-punctuation">{word.text}</span>;
  }

  const familiarity = resolveFamiliarity(word);
  const hasReading = !!word.reading && word.reading !== word.text;
  const isKana = /^[\u3040-\u309F\u30A0-\u30FF]+$/.test(word.text);

  const content = hasReading ? (
    <ruby className="wild-ruby">
      {word.text}
      <rp>(</rp>
      <rt>{word.reading}</rt>
      <rp>)</rp>
    </ruby>
  ) : (
    word.text
  );

  // Studied — the learner has reviewed this exact word/kanji. Full highlight,
  // no furigana needed; keep as a non-interactive mark (tapping "Add to vocab"
  // for something already studied would be confusing).
  if (familiarity === "studied") {
    return (
      <span
        className="wild-studied-word"
        role="mark"
        aria-label={`${word.text}: you've studied this`}
        title="You've studied this word"
      >
        {word.text}
      </span>
    );
  }

  // Partial — contains a studied kanji but the word itself is new to the
  // learner. Distinct visual + always tappable so they can explore or add it.
  if (familiarity === "partial") {
    const ariaLabel = `${word.text}: contains a kanji you've studied — this word itself is new`;
    if (onTapWord) {
      return (
        <button
          type="button"
          onClick={() => onTapWord(word)}
          className="wild-partial-word wild-tappable-word"
          role="mark"
          aria-label={ariaLabel}
          title="Contains a kanji you've studied — tap for details"
        >
          {content}
        </button>
      );
    }
    return (
      <span className="wild-partial-word" role="mark" aria-label={ariaLabel}>
        {content}
      </span>
    );
  }

  if (onTapWord && !isKana) {
    return (
      <button
        type="button"
        onClick={() => onTapWord(word)}
        className="wild-tappable-word"
      >
        {content}
      </button>
    );
  }

  return <span>{content}</span>;
}

/**
 * Small, muted legend explaining the two highlight styles. Rendered once
 * per sentence viewer (not on every card in the library list). Keeps the
 * UX discoverable without being noisy.
 */
export function WildLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`wild-legend ${compact ? "wild-legend-compact" : ""}`}
      aria-label="Highlight legend"
    >
      <Info className="h-3 w-3 opacity-60 shrink-0" aria-hidden="true" />
      <span className="wild-legend-item">
        <span className="wild-studied-swatch" aria-hidden="true">漢</span>
        <span className="wild-legend-text">Studied</span>
      </span>
      <span className="wild-legend-sep" aria-hidden="true">·</span>
      <span className="wild-legend-item">
        <span className="wild-partial-swatch" aria-hidden="true">漢</span>
        <span className="wild-legend-text">Contains studied kanji</span>
      </span>
    </div>
  );
}

const RATING_CONFIG: Record<DifficultyRating, {
  label: string;
  icon: typeof Zap;
  bg: string;
  border: string;
  text: string;
  hoverBg: string;
  activeBg: string;
}> = {
  too_easy: {
    label: "Too Easy",
    icon: Zap,
    bg: "bg-sky-50 dark:bg-sky-950/40",
    border: "border-sky-200 dark:border-sky-800",
    text: "text-sky-700 dark:text-sky-300",
    hoverBg: "hover:bg-sky-100 dark:hover:bg-sky-900/50",
    activeBg: "bg-sky-100 dark:bg-sky-900/60 ring-2 ring-sky-400 dark:ring-sky-500",
  },
  just_right: {
    label: "Just Right",
    icon: ThumbsUp,
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-300",
    hoverBg: "hover:bg-emerald-100 dark:hover:bg-emerald-900/50",
    activeBg: "bg-emerald-100 dark:bg-emerald-900/60 ring-2 ring-emerald-400 dark:ring-emerald-500",
  },
  too_hard: {
    label: "Too Hard",
    icon: TrendingUp,
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-300",
    hoverBg: "hover:bg-amber-100 dark:hover:bg-amber-900/50",
    activeBg: "bg-amber-100 dark:bg-amber-900/60 ring-2 ring-amber-400 dark:ring-amber-500",
  },
};

const RATINGS: DifficultyRating[] = ["too_easy", "just_right", "too_hard"];

export function SentenceDisplay({ sentence, showAddWord = false, compact = false, showLegend = false, onRate, currentRating }: SentenceDisplayProps) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [addingWord, setAddingWord] = useState<WildWord | null>(null);
  const [addStatus, setAddStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [addError, setAddError] = useState<string | null>(null);

  const words: WildWord[] = Array.isArray(sentence.words)
    ? sentence.words
    : [];

  async function handleAddWord(word: WildWord) {
    if (!showAddWord) return;
    setAddingWord(word);
    setAddStatus("idle");
    setAddError(null);
  }

  async function confirmAddWord() {
    if (!addingWord) return;
    setAddStatus("loading");

    try {
      // We pass the sentence context so the server can look the word up with
      // disambiguation rather than saving whatever partial data the wild
      // generator happened to include. The server is responsible for
      // producing a real reading + meanings; the client never sends a
      // placeholder.
      const res = await fetch("/api/vocabulary/quick-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: addingWord.text,
          reading: addingWord.reading ?? undefined,
          hintMeaning: addingWord.meaning ?? undefined,
          sentenceJapanese: sentence.japanese,
          sentenceEnglish: sentence.english,
        }),
      });

      if (res.status === 409) {
        setAddStatus("success");
        setAddError("Already in your library!");
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to add");
      }

      const data: { enrichment?: { succeeded: boolean } } = await res
        .json()
        .catch(() => ({}));
      setAddStatus("success");
      if (data.enrichment && !data.enrichment.succeeded) {
        // Option B: we saved the row, but enrichment failed. Tell the user
        // the word is in their library and we'll fill in the definition
        // automatically — no action required from them.
        setAddError("Added! Definition will be filled in shortly.");
      }
    } catch {
      setAddStatus("error");
      setAddError("Failed to add word");
    }
  }

  const targetItems = sentence.targets?.map((t) => t.itemText) || [];
  const hasPartialWord = words.some((w) => resolveFamiliarity(w) === "partial");
  const hasStudiedWord = words.some((w) => resolveFamiliarity(w) === "studied");
  const addingFamiliarity = addingWord ? resolveFamiliarity(addingWord) : "unknown";

  return (
    <div className={`space-y-6 ${compact ? "" : "py-4"}`}>
      {/* Legend — shown on demand, and only when the sentence actually has
          marks to explain, so we don't noise up the reading experience. */}
      {showLegend && (hasStudiedWord || hasPartialWord) && (
        <WildLegend compact={compact} />
      )}

      {/* Target items badge row */}
      {!compact && targetItems.length > 0 && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {targetItems.map((item) => (
            <span
              key={item}
              className="wild-kanji-pill inline-flex items-center px-3 py-1 rounded-full bg-amber-100/80 text-amber-800 text-sm font-medium dark:bg-amber-900/30 dark:text-amber-200"
            >
              {item}
            </span>
          ))}
        </div>
      )}

      {/* Japanese sentence */}
      <div className={`wild-sentence-text ${compact ? "text-xl" : "text-3xl sm:text-4xl"} leading-relaxed text-center`}>
        {words.map((word, i) => (
          <WordToken
            key={`${word.text}-${i}`}
            word={word}
            onTapWord={showAddWord ? handleAddWord : undefined}
          />
        ))}
      </div>

      {/* Translation reveal */}
      <div className="text-center">
        <AnimatePresence mode="wait">
          {showTranslation ? (
            <motion.div
              key="translation"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <p className={`wild-translation-text text-muted-foreground ${compact ? "text-sm" : "text-lg sm:text-xl"}`}>
                {sentence.english}
              </p>

              {/* Difficulty rating buttons */}
              {onRate && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.25 }}
                  className="space-y-2"
                >
                  <p className="wild-rating-label text-xs text-muted-foreground/50 uppercase tracking-wider font-medium">
                    How was this sentence?
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    {RATINGS.map((rating) => {
                      const config = RATING_CONFIG[rating];
                      const Icon = config.icon;
                      const isSelected = currentRating === rating;

                      return (
                        <button
                          key={rating}
                          onClick={() => onRate(sentence.id, rating)}
                          className={`
                            flex items-center gap-1.5 rounded-xl border-2 transition-all
                            active:scale-95
                            ${isSelected
                              ? `${config.activeBg} ${config.border} ${config.text}`
                              : `${config.bg} ${config.border} ${config.text} ${config.hoverBg}`
                            }
                            ${compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"}
                          `}
                        >
                          <Icon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
                          <span className="font-medium">{config.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              <button
                onClick={() => setShowTranslation(false)}
                className="wild-hide-translation text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                hide translation
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="reveal-btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTranslation(true)}
              className="wild-hint-text inline-flex items-center gap-2 text-sm text-muted-foreground/70 hover:text-muted-foreground transition-colors py-2 px-4 rounded-full hover:bg-white/[0.06]"
            >
              <Eye className="h-4 w-4" />
              Tap to see translation
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Add word dialog */}
      <AnimatePresence>
        {addingWord && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4"
          >
            <div className="bg-card border-2 rounded-2xl shadow-xl p-4 max-w-sm w-full space-y-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  {addingFamiliarity === "partial" && (
                    <p className="text-[11px] font-medium uppercase tracking-wider text-teal-700 dark:text-teal-300 mb-1">
                      New compound · contains studied kanji
                    </p>
                  )}
                  <p className="font-bold text-lg">{addingWord.text}</p>
                  {addingWord.reading && (
                    <p className="text-sm text-muted-foreground">{addingWord.reading}</p>
                  )}
                  {addingWord.meaning && (
                    <p className="text-sm font-medium mt-1">{addingWord.meaning}</p>
                  )}
                </div>
                <button
                  onClick={() => { setAddingWord(null); setAddStatus("idle"); }}
                  className="p-1 rounded-lg hover:bg-muted transition-colors"
                >
                  <span className="sr-only">Close</span>
                  ✕
                </button>
              </div>

              {addStatus === "idle" && (
                <button
                  onClick={confirmAddWord}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add to My Vocabulary
                </button>
              )}

              {addStatus === "loading" && (
                <div className="flex items-center justify-center gap-2 py-2.5 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </div>
              )}

              {addStatus === "success" && (
                <div className="flex items-center justify-center gap-2 py-2.5 text-emerald-600">
                  <Check className="h-4 w-4" />
                  {addError || "Added to your library!"}
                </div>
              )}

              {addStatus === "error" && (
                <div className="text-center py-2.5">
                  <p className="text-sm text-destructive">{addError}</p>
                  <button
                    onClick={confirmAddWord}
                    className="text-sm text-primary mt-1 hover:underline"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
