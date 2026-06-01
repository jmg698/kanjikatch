"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Check, Loader2, Zap, ThumbsUp, TrendingUp, Eye, Languages } from "lucide-react";
import type { WildSentenceData, WildWord, WordFamiliarity } from "./in-the-wild";

export type DifficultyRating = "too_easy" | "just_right" | "too_hard";

interface SentenceDisplayProps {
  sentence: WildSentenceData;
  showAddWord?: boolean;
  compact?: boolean;
  onRate?: (sentenceId: string, rating: DifficultyRating) => void;
  currentRating?: DifficultyRating | null;
  /** Show a one-line explainer above the rating buttons describing what
   *  the ratings do. Used by onboarding for the first wild sentence so
   *  first-time raters understand the mechanic. See ONBOARDING_PLAN.md
   *  Phase 2.0 item 6. */
  showRatingHint?: boolean;
  /** Show a one-line nudge above the sentence prompting the user to tap
   *  any new word to add it to their library. Used by onboarding for the
   *  first wild sentence so first-time users discover the compounding
   *  loop. See ONBOARDING_PLAN.md §Step 5a. */
  showTapToCatchHint?: boolean;
  /** Run the stepped onboarding coach on this sentence: a guided sequence
   *  that walks a first-time reader through the loop — try reading it,
   *  reveal the reading, reveal the translation, then tap a word to catch
   *  it. Each step highlights the relevant control and advances on the
   *  matching action. Never blocks progress (the rating still auto-advances
   *  the session). Used by onboarding for the first wild sentence only. */
  coach?: boolean;
}

type CoachStep = "reading" | "translation" | "tap" | "done";

const COACH_COPY: Record<Exclude<CoachStep, "done">, { step: number; title: string; body: string }> = {
  reading: {
    step: 1,
    title: "Try reading it first.",
    body: "Say it in your head. Stuck on a word? Reveal the reading below.",
  },
  translation: {
    step: 2,
    title: "Now check yourself.",
    body: "Reveal the translation to see how close you were.",
  },
  tap: {
    step: 3,
    title: "Catch a new word.",
    body: "Tap any highlighted word for its meaning — or add it to your library.",
  },
};

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

function WordToken({ word, showFurigana, onTapWord, highlight = false }: { word: WildWord; showFurigana: boolean; onTapWord?: (word: WildWord) => void; highlight?: boolean }) {
  const isPunctuation = /^[。、！？「」『』（）\s…・ー～]+$/.test(word.text);

  if (isPunctuation) {
    return <span className="wild-punctuation">{word.text}</span>;
  }

  // The onboarding coach's "tap a word" step rings the tappable tokens so a
  // first-time reader can see what's interactive.
  const highlightClass = highlight
    ? " ring-2 ring-amber-400 rounded-md animate-pulse"
    : "";

  const familiarity = resolveFamiliarity(word);
  const hasReading = !!word.reading && word.reading !== word.text;
  const isKana = /^[\u3040-\u309F\u30A0-\u30FF]+$/.test(word.text);

  const content = hasReading && showFurigana ? (
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
          className={`wild-partial-word wild-tappable-word${highlightClass}`}
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
        className={`wild-tappable-word${highlightClass}`}
      >
        {content}
      </button>
    );
  }

  return <span>{content}</span>;
}

function RevealButton({
  active,
  inactiveLabel,
  activeLabel,
  Icon,
  onClick,
  compact,
  pulse = false,
}: {
  active: boolean;
  inactiveLabel: string;
  activeLabel: string;
  Icon: typeof Eye;
  onClick: () => void;
  compact?: boolean;
  /** Draw a pulsing ring to point the onboarding coach at this control. */
  pulse?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      whileTap={{ scale: 0.94 }}
      transition={{ type: "spring", stiffness: 500, damping: 24 }}
      className={`wild-reveal-button group inline-flex items-center gap-2 rounded-full border-2 font-medium transition-colors ${
        compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
      } ${
        pulse ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-transparent animate-pulse" : ""
      } ${
        active
          ? "wild-reveal-button--on bg-amber-100 border-amber-400 text-amber-900 shadow-sm"
          : "wild-reveal-button--off bg-white border-stone-300 text-stone-700 hover:border-stone-400 hover:bg-stone-50"
      }`}
    >
      <span className="relative inline-flex h-4 w-4 items-center justify-center">
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={active ? "on" : "off"}
            initial={{ rotate: -90, scale: 0.6, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute inline-flex"
          >
            {active ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
          </motion.span>
        </AnimatePresence>
      </span>
      <span>{active ? activeLabel : inactiveLabel}</span>
    </motion.button>
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

export function SentenceDisplay({ sentence, showAddWord = false, compact = false, onRate, currentRating, showRatingHint = false, showTapToCatchHint = false, coach = false }: SentenceDisplayProps) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [showFurigana, setShowFurigana] = useState(false);
  const [addingWord, setAddingWord] = useState<WildWord | null>(null);
  const [addStatus, setAddStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [addError, setAddError] = useState<string | null>(null);

  // Stepped onboarding coach. Advances as the user performs each action;
  // "Skip tips" or a word-tap on the last step finishes it. The coach never
  // gates the session — rating still auto-advances regardless of coach state.
  const [coachStep, setCoachStep] = useState<CoachStep>("reading");
  useEffect(() => {
    if (!coach) return;
    if (coachStep === "reading" && showFurigana) setCoachStep("translation");
    else if (coachStep === "translation" && showTranslation) setCoachStep("tap");
  }, [coach, coachStep, showFurigana, showTranslation]);
  useEffect(() => {
    if (coach && coachStep === "tap" && addingWord) setCoachStep("done");
  }, [coach, coachStep, addingWord]);

  const coachActive = coach && coachStep !== "done";

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

  const addingFamiliarity = addingWord ? resolveFamiliarity(addingWord) : "unknown";

  return (
    <div className={`space-y-6 ${compact ? "" : "py-4"}`}>
      {coachActive && (
        <AnimatePresence mode="wait">
          <motion.div
            key={coachStep}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mx-auto max-w-md rounded-2xl border-2 border-amber-300 bg-amber-50/95 px-4 py-3 text-center shadow-sm dark:border-amber-700 dark:bg-amber-950/60"
          >
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-amber-700/80 dark:text-amber-300/80">
              Step {COACH_COPY[coachStep].step} of 3
            </p>
            <p className="mt-1 font-semibold text-amber-900 dark:text-amber-100">
              {COACH_COPY[coachStep].title}
            </p>
            <p className="mt-0.5 text-sm text-amber-800/80 dark:text-amber-200/70 leading-relaxed">
              {COACH_COPY[coachStep].body}
            </p>
            <button
              type="button"
              onClick={() => setCoachStep("done")}
              className="mt-2 text-[11px] font-medium text-amber-700/70 hover:text-amber-900 underline underline-offset-2 transition-colors dark:text-amber-300/70 dark:hover:text-amber-100"
            >
              Skip tips
            </button>
          </motion.div>
        </AnimatePresence>
      )}

      {showTapToCatchHint && showAddWord && !coach && (
        <div className="text-center">
          <p className="inline-block text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/80 bg-white/40 backdrop-blur-sm border px-3 py-1.5 rounded-full" style={{ borderColor: "rgba(255,255,255,0.3)" }}>
            Tap any new word to catch it
          </p>
          <p className="mt-2 text-xs text-muted-foreground/70 italic">
            Your reading grows your library.
          </p>
        </div>
      )}

      {/* Japanese sentence */}
      <div className={`wild-sentence-text ${compact ? "text-xl" : "text-3xl sm:text-4xl"} leading-relaxed text-center`}>
        {words.map((word, i) => (
          <WordToken
            key={`${word.text}-${i}`}
            word={word}
            showFurigana={showFurigana}
            onTapWord={showAddWord ? handleAddWord : undefined}
            highlight={coachActive && coachStep === "tap"}
          />
        ))}
      </div>

      {/* Translation + reveal toggles + rating */}
      <div className="text-center space-y-4">
        <AnimatePresence mode="wait">
          {showTranslation && (
            <motion.p
              key="translation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`wild-translation-text text-muted-foreground ${compact ? "text-sm" : "text-lg sm:text-xl"}`}
            >
              {sentence.english}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <RevealButton
            active={showFurigana}
            inactiveLabel="Show Reading"
            activeLabel="Reading"
            Icon={Eye}
            onClick={() => setShowFurigana((v) => !v)}
            compact={compact}
            pulse={coachActive && coachStep === "reading"}
          />
          <RevealButton
            active={showTranslation}
            inactiveLabel="Show Translation"
            activeLabel="Translation"
            Icon={Languages}
            onClick={() => setShowTranslation((v) => !v)}
            compact={compact}
            pulse={coachActive && coachStep === "translation"}
          />
        </div>

        <AnimatePresence initial={false}>
          {onRate && showTranslation && (
            <motion.div
              key="rating"
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 300, damping: 24, mass: 0.7 }}
              className="space-y-2"
            >
              <p className="wild-rating-label text-xs text-muted-foreground/50 uppercase tracking-wider font-medium">
                How was this sentence?
              </p>
              {showRatingHint && (
                <p className="text-xs text-muted-foreground/80 max-w-md mx-auto leading-relaxed italic">
                  Your ratings teach KanjiKatch what &ldquo;just right&rdquo; feels
                  like for you. Future sentences calibrate from this.
                </p>
              )}
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
