"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SentenceDisplay, type DifficultyRating } from "@/components/wild/sentence-display";
import type { WildSentenceData } from "@/components/wild/in-the-wild";

interface InterludeReadingProps {
  sentences: WildSentenceData[];
  ratings: Record<string, DifficultyRating>;
  onRate: (sentenceId: string, rating: DifficultyRating) => void;
  onComplete: () => void;
}

/**
 * Mid-session reading interlude. Renders sentences inside the same white
 * card chassis used by the flashcard so the only mode signal is the
 * surrounding pastel buttercup background.
 *
 * No subtitle copy by design — the lighting change carries the message.
 */
export function InterludeReading({
  sentences,
  ratings,
  onRate,
  onComplete,
}: InterludeReadingProps) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const total = sentences.length;
  const current = sentences[index];
  const isLast = index === total - 1;

  const goNext = useCallback(() => {
    if (isLast) {
      onComplete();
    } else {
      setDirection(1);
      setIndex((i) => i + 1);
    }
  }, [isLast, onComplete]);

  const goPrev = useCallback(() => {
    if (index === 0) return;
    setDirection(-1);
    setIndex((i) => i - 1);
  }, [index]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  // Swipe support — mirrors InTheWild's gesture handling.
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const SWIPE_THRESHOLD = 50;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;
      if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0) goNext();
        else goPrev();
      }
      touchStartX.current = null;
      touchStartY.current = null;
    },
    [goNext, goPrev],
  );

  if (!current) return null;

  return (
    <div
      className="w-full max-w-2xl mx-auto flex flex-col items-center gap-5"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center gap-1.5">
        {sentences.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === index ? "w-6 bg-amber-500" : "w-1.5 bg-amber-900/20"
            }`}
            aria-hidden
          />
        ))}
      </div>

      <div className="w-full">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="bg-white rounded-3xl shadow-xl px-6 py-8 sm:px-10 sm:py-10"
          >
            <SentenceDisplay
              sentence={current}
              showAddWord
              onRate={onRate}
              currentRating={ratings[current.id] ?? null}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={goNext}
        className="inline-flex items-center gap-2 rounded-full bg-foreground/90 text-background px-6 py-2.5 text-sm font-semibold shadow-md hover:bg-foreground transition-colors active:scale-[0.98]"
      >
        {isLast ? "Continue review" : "Next"}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
