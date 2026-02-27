"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
}

const GRADE_STYLES: Record<Grade, { bg: string; border: string; text: string; hoverBg: string }> = {
  again: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", hoverBg: "hover:bg-orange-100" },
  hard: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", hoverBg: "hover:bg-amber-100" },
  good: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", hoverBg: "hover:bg-emerald-100" },
  easy: { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700", hoverBg: "hover:bg-indigo-100" },
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
}: ReviewCardProps) {
  const [revealed, setRevealed] = useState(false);

  // Reset on new item
  useEffect(() => {
    setRevealed(false);
  }, [item.id, questionType]);

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
  }, [revealed, handleReveal, handleGrade]);

  const questionText =
    questionType === "meaning"
      ? "What does this mean?"
      : "How do you read this?";

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Progress bar */}
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

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${item.id}-${questionType}`}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <div
            className="jr-panel rounded-2xl overflow-hidden cursor-pointer select-none"
            onClick={handleReveal}
          >
            {/* Question Type Badge */}
            <div className="px-6 pt-5 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                {item.type === "kanji" ? "Kanji" : "Vocabulary"}
              </span>
              <span className="text-xs text-muted-foreground">
                {questionText}
              </span>
            </div>

            {/* Prompt */}
            <div className="px-6 py-8 text-center">
              <motion.div
                className={`font-bold leading-none ${item.type === "kanji" ? "text-8xl md:text-9xl" : "text-5xl md:text-6xl"}`}
                layoutId={`prompt-${item.id}`}
              >
                {item.prompt}
              </motion.div>

              {/* Personal Context */}
              <div className="mt-4 flex items-center justify-center gap-3 text-xs text-muted-foreground">
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
            </div>

            {/* Answer Section */}
            <AnimatePresence>
              {revealed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="border-t-2 border-dashed border-border"
                >
                  <div className="px-6 py-6 space-y-3">
                    {/* Meanings */}
                    <div className="text-center">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium block mb-1">
                        Meaning
                      </span>
                      <p className="text-xl font-semibold">
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
                        <p className="text-lg">{item.readings.join(", ")}</p>
                      )}
                    </div>

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
              <div className="px-6 pb-5 text-center">
                <motion.p
                  className="text-sm text-muted-foreground"
                  animate={{ opacity: [0.4, 0.7, 0.4] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  Tap to reveal · <kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs font-mono">Space</kbd>
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
            className="grid grid-cols-4 gap-2"
          >
            {gradeOptions.map((option, i) => {
              const style = GRADE_STYLES[option.grade];
              return (
                <button
                  key={option.grade}
                  onClick={() => handleGrade(option.grade)}
                  disabled={disabled}
                  className={`
                    flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all
                    ${style.bg} ${style.border} ${style.text} ${style.hoverBg}
                    active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                    min-h-[72px] md:min-h-[80px]
                  `}
                >
                  <span className="text-sm font-semibold capitalize">{option.grade}</span>
                  <span className="text-xs opacity-70">{option.label}</span>
                  <kbd className="text-[10px] opacity-40 font-mono">{i + 1}</kbd>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
