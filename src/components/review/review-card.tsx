"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Eye, EyeOff, Undo2, ChevronDown } from "lucide-react";
import type { ReviewQueueItem } from "./review-types";
import type { Grade } from "@/lib/srs";
import { getGradeOptions, type SrsState } from "@/lib/srs";

interface ReviewCardProps {
  item: ReviewQueueItem;
  index: number;
  total: number;
  questionType: "meaning" | "reading";
  consecutiveCorrect: number;
  onGrade: (grade: Grade) => void;
  disabled: boolean;
  /** When true, card is shown in full-screen review mode (larger, no in-card progress) */
  fullScreen?: boolean;
  /** Whether this card is a re-queued retry within the current session */
  isRetry?: boolean;
  /** Why this card was re-queued (drives retry banner copy). */
  retryReason?: "missed" | "hard";
  /** Whether the previous submission can be undone. */
  canUndo?: boolean;
  /** Trigger undo of the previous submission. */
  onUndo?: () => void;
  /** Whether undo is in progress (disable controls). */
  undoing?: boolean;
}

const GRADE_STYLES: Record<Grade, { bg: string; border: string; text: string; hoverBg: string }> = {
  again: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", hoverBg: "hover:bg-orange-100" },
  hard: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", hoverBg: "hover:bg-amber-100" },
  good: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", hoverBg: "hover:bg-emerald-100" },
  easy: { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700", hoverBg: "hover:bg-indigo-100" },
};

const GRADE_HINT: Record<Grade, string> = {
  again: "Forgot completely",
  hard: "Barely remembered",
  good: "Knew it",
  easy: "Knew instantly",
};

const GRADE_KEYS: Record<string, Grade> = {
  "1": "again",
  "2": "hard",
  "3": "good",
  "4": "easy",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ReviewCard({
  item,
  index,
  total,
  questionType,
  consecutiveCorrect,
  onGrade,
  disabled,
  fullScreen = false,
  isRetry = false,
  retryReason,
  canUndo = false,
  onUndo,
  undoing = false,
}: ReviewCardProps) {
  const [revealed, setRevealed] = useState(false);
  const [showFurigana, setShowFurigana] = useState(false);
  const [showRetryExplanation, setShowRetryExplanation] = useState(false);

  // Reset on new item (index included so retries of the same item re-trigger)
  useEffect(() => {
    setRevealed(false);
    setShowFurigana(false);
    setShowRetryExplanation(false);
  }, [item.id, questionType, index]);

  // Furigana hint is only useful on the meaning prompt for vocab that contains kanji.
  // For kanji items the prompt IS the kanji (so the reading is the answer); for vocab
  // reading questions, exposing the reading would defeat the question.
  const canShowFurigana =
    item.type === "vocab" &&
    questionType === "meaning" &&
    item.readings.length > 0 &&
    item.prompt !== item.readings[0];

  const srsState: SrsState = {
    intervalDays: item.intervalDays,
    easeFactor: parseFloat(item.easeFactor),
    reviewCount: item.reviewCount,
    timesCorrect: item.timesCorrect,
    confidenceLevel: item.confidenceLevel as SrsState["confidenceLevel"],
  };

  const gradeOptions = getGradeOptions(srsState, consecutiveCorrect);

  const handleReveal = useCallback(() => {
    if (!revealed && !disabled) setRevealed(true);
  }, [revealed, disabled]);

  const handleGrade = useCallback(
    (grade: Grade) => {
      if (revealed && !disabled) onGrade(grade);
    },
    [revealed, disabled, onGrade],
  );

  // Keyboard shortcuts
  useEffect(() => {
    if (disabled) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (!revealed && e.key === " ") {
        e.preventDefault();
        handleReveal();
      }

      if (revealed && GRADE_KEYS[e.key]) {
        e.preventDefault();
        handleGrade(GRADE_KEYS[e.key]);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [revealed, disabled, handleReveal, handleGrade]);

  const questionText =
    questionType === "meaning"
      ? (fullScreen ? "Meaning" : "What does this mean?")
      : (fullScreen ? "Reading" : "How do you read this?");
  const retryTitle = retryReason === "hard" ? "Quick recheck: you marked this hard earlier." : "Quick recheck: you missed this earlier.";
  const retryExplanation =
    retryReason === "hard"
      ? "Cards marked hard come back once in this session so the reading sticks before you move on."
      : "Missed cards return later in the same session to reinforce memory and improve retention.";

  return (
    <div className={fullScreen ? "w-full space-y-4 md:space-y-6" : "max-w-lg mx-auto space-y-4"}>
      {/* Progress bar — hidden in full-screen (shown in session header) */}
      {!fullScreen && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: `${((index) / total) * 100}%` }}
              animate={{ width: `${((index) / total) * 100}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
          <span className="text-sm font-mono text-muted-foreground whitespace-nowrap">
            {index}/{total}
          </span>
        </div>
      )}

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${item.id}-${questionType}-${index}`}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <div
            className={`jr-panel overflow-hidden cursor-pointer select-none ${fullScreen ? "rounded-3xl bg-white shadow-xl" : "rounded-2xl"}`}
            onClick={handleReveal}
          >
            <AnimatePresence initial={false}>
              {isRetry && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="border-b border-orange-200/70 bg-orange-50/80"
                >
                  <div className={fullScreen ? "px-8 py-3" : "px-6 py-2.5"}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="inline-flex items-center gap-2 text-sm font-medium text-orange-800">
                        <RotateCcw className="h-3.5 w-3.5" />
                        {retryTitle}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowRetryExplanation((prev) => !prev);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-orange-700/90 hover:text-orange-900 transition-colors whitespace-nowrap"
                        aria-expanded={showRetryExplanation}
                      >
                        Why am I seeing this?
                        <ChevronDown className={`h-3 w-3 transition-transform ${showRetryExplanation ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                    <AnimatePresence initial={false}>
                      {showRetryExplanation && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                          className="pt-2 text-xs leading-relaxed text-orange-900/80 pr-6"
                        >
                          {retryExplanation}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Question Type / Prompt label — minimal in full-screen */}
            <div className={fullScreen ? "px-8 pt-6 flex items-center justify-between gap-2" : "px-6 pt-5 flex items-center justify-between"}>
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                {item.type === "kanji" ? "Kanji" : "Vocabulary"}
              </span>
              {canShowFurigana && !revealed && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFurigana((v) => !v);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground rounded-md px-2 py-1 -my-1 hover:bg-secondary transition-colors"
                  aria-pressed={showFurigana}
                  aria-label={showFurigana ? "Hide reading hint" : "Show reading hint"}
                >
                  {showFurigana ? (
                    <EyeOff className="h-3 w-3" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                  <span>{showFurigana ? "Hide reading" : "Show reading"}</span>
                </button>
              )}
              {revealed && !fullScreen && (
                <span className="text-xs text-muted-foreground">
                  {questionText}
                </span>
              )}
            </div>

            {/* Prompt — larger in full-screen, WaniKani-style */}
            <div className={fullScreen ? "px-8 py-10 md:py-14 text-center" : "px-6 py-8 text-center"}>
              {/* Furigana hint above prompt for vocab meaning questions */}
              {canShowFurigana && showFurigana && !revealed && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`text-muted-foreground mb-3 ${fullScreen ? "text-xl md:text-2xl" : "text-base md:text-lg"}`}
                >
                  {item.readings[0]}
                </motion.p>
              )}
              <motion.div
                className={`font-bold leading-none ${fullScreen ? (item.type === "kanji" ? "text-9xl md:text-[12rem]" : "text-6xl md:text-8xl") : (item.type === "kanji" ? "text-8xl md:text-9xl" : "text-5xl md:text-6xl")}`}
                layoutId={`prompt-${item.id}`}
              >
                {item.prompt}
              </motion.div>
            </div>

            {/* Full-screen: show question type below character when revealed (WaniKani-style) */}
            {fullScreen && revealed && (
              <p className="text-center text-sm text-muted-foreground -mt-4 pb-2">
                {questionText}
              </p>
            )}

            {/* Answer Section */}
            <AnimatePresence>
              {revealed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="border-t-2 border-dashed border-border"
                >
                  <div className={fullScreen ? "px-8 py-8 space-y-4" : "px-6 py-6 space-y-3"}>
                    {/* Personal Context — hide in full-screen to reduce clutter */}
                    {!fullScreen && (
                    <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
                      <span>Captured {formatDate(item.firstSeenAt)}</span>
                      <span className="opacity-30">·</span>
                      <span>Seen {item.timesSeen}x</span>
                      {item.reviewCount > 0 && (
                        <>
                          <span className="opacity-30">·</span>
                          <span>Reviewed {item.reviewCount}x</span>
                        </>
                      )}
                    </div>
                    )}

                    {/* Meanings */}
                    <div className="text-center">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium block mb-1">
                        Meaning
                      </span>
                      <p className={fullScreen ? "text-2xl font-semibold" : "text-xl font-semibold"}>
                        {item.meanings.join(", ")}
                      </p>
                    </div>

                    {/* Readings */}
                    <div className="text-center">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium block mb-1">
                        Reading
                      </span>
                      {item.type === "kanji" ? (
                        <div className="space-y-1">
                          {item.readings.length > 0 && (
                            <p className="text-lg">
                              <span className="text-muted-foreground text-sm mr-1">On:</span>
                              {item.readings.join(", ")}
                            </p>
                          )}
                          {item.readingsKun && item.readingsKun.length > 0 && (
                            <p className="text-lg">
                              <span className="text-muted-foreground text-sm mr-1">Kun:</span>
                              {item.readingsKun.join(", ")}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {item.prompt !== item.readings[0] && (
                            <p className={fullScreen ? "text-3xl font-bold" : "text-2xl font-bold"}>{item.prompt}</p>
                          )}
                          <p className="text-lg">{item.readings.join(", ")}</p>
                        </div>
                      )}
                    </div>

                    {item.kanjiDetails && item.kanjiDetails.length > 0 && (
                      <div className="text-center">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium block mb-1">
                          Kanji
                        </span>
                        <div className="flex items-center justify-center gap-3 flex-wrap">
                          {item.kanjiDetails.map((k) => (
                            <span key={k.character} className="inline-flex items-center gap-1.5">
                              <span className={fullScreen ? "text-2xl font-bold" : "text-xl font-bold"}>{k.character}</span>
                              <span className="text-sm text-muted-foreground">({k.meanings.slice(0, 2).join(", ")})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {item.partOfSpeech && (
                      <p className="text-center text-xs text-muted-foreground">
                        {item.partOfSpeech}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tap to reveal hint */}
            {!revealed && (
              <div className={fullScreen ? "px-8 pb-8 text-center" : "px-6 pb-5 text-center"}>
                <motion.p
                  className="text-sm text-muted-foreground"
                  animate={{ opacity: [0.4, 0.7, 0.4] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  {fullScreen ? "Tap or press Space to reveal" : "Tap to reveal · "}
                  {!fullScreen && <kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs font-mono">Space</kbd>}
                </motion.p>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Grade Buttons */}
      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.25 }}
            className={fullScreen ? "max-w-xl mx-auto space-y-3" : "space-y-2"}
          >
            <div className={fullScreen ? "grid grid-cols-4 gap-3" : "grid grid-cols-4 gap-2"}>
              {gradeOptions.map((option) => {
                const style = GRADE_STYLES[option.grade];
                return (
                  <button
                    key={option.grade}
                    onClick={() => handleGrade(option.grade)}
                    disabled={disabled}
                    className={`
                      flex flex-col items-center gap-1 rounded-xl border-2 transition-all
                      ${style.bg} ${style.border} ${style.text} ${style.hoverBg}
                      active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                      ${fullScreen ? "p-4 min-h-[80px] md:min-h-[88px]" : "p-3 min-h-[72px] md:min-h-[80px]"}
                    `}
                  >
                    <span className={fullScreen ? "text-base font-semibold capitalize" : "text-sm font-semibold capitalize"}>{option.grade}</span>
                    <span className="text-xs opacity-70 leading-tight text-center px-0.5">
                      {GRADE_HINT[option.grade]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Redo last card affordance: small, unobtrusive, only when available */}
            {canUndo && onUndo && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={onUndo}
                  disabled={undoing || disabled}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 disabled:opacity-50"
                  aria-label="Redo last card"
                >
                  <Undo2 className="h-3 w-3" />
                  <span>{undoing ? "Redoing…" : "Redo last card"}</span>
                  <kbd className="px-1 py-0.5 rounded bg-secondary border border-border text-[10px] font-mono">U</kbd>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent redo-last-card affordance even before reveal — shown small below the prompt */}
      {!revealed && canUndo && onUndo && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onUndo}
            disabled={undoing || disabled}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 disabled:opacity-50"
            aria-label="Redo last card"
          >
            <Undo2 className="h-3 w-3" />
            <span>{undoing ? "Redoing…" : "Redo last card"}</span>
            <kbd className="px-1 py-0.5 rounded bg-secondary border border-border text-[10px] font-mono">U</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
