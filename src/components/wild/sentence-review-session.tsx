"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, BookOpen, Loader2, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SentenceDisplay, type DifficultyRating } from "./sentence-display";
import { StaticGoldenHourBackground } from "./static-golden-hour-background";
import type { WildSentenceData } from "./in-the-wild";

interface SentenceReviewSessionProps {
  onClose: () => void;
}

export function SentenceReviewSession({ onClose }: SentenceReviewSessionProps) {
  const [sentences, setSentences] = useState<WildSentenceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [ratings, setRatings] = useState<Record<string, DifficultyRating>>({});

  const fetchRandomSentences = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sentences/library?sort=random&limit=10");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const fetched: WildSentenceData[] = data.sentences || [];
      setSentences(fetched);
      setCurrentIndex(0);
      setDirection(0);

      const existingRatings: Record<string, DifficultyRating> = {};
      for (const s of fetched) {
        if (s.difficultyRating) existingRatings[s.id] = s.difficultyRating;
      }
      setRatings(existingRatings);
    } catch (e) {
      console.error("Failed to fetch sentences for review:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRandomSentences();
  }, [fetchRandomSentences]);

  const handleRate = useCallback(async (sentenceId: string, rating: DifficultyRating) => {
    setRatings((prev) => ({ ...prev, [sentenceId]: rating }));
    try {
      await fetch("/api/sentences/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentenceId, rating }),
      });
    } catch {
      // Optimistic — silent fail
    }
  }, []);

  const goNext = useCallback(() => {
    if (currentIndex < sentences.length - 1) {
      setDirection(1);
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, sentences.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev, onClose]);

  // Swipe gesture handling
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const SWIPE_THRESHOLD = 50;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  }, [goNext, goPrev]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col">
        <StaticGoldenHourBackground />
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 gap-6">
          <div className="rounded-[14px] bg-[rgba(30,26,48,0.35)] backdrop-blur-[16px] px-10 py-8 border border-white/[0.08] flex flex-col items-center gap-6" style={{ WebkitBackdropFilter: "blur(16px)" }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <BookOpen className="h-12 w-12 text-[#F0C88A] opacity-60" />
            </motion.div>
            <div className="text-center space-y-2">
              <p className="text-lg font-medium text-[#F5F0E6]">Loading sentences...</p>
              <p className="text-sm text-[#F5F0E6]/50">
                Picking random sentences from your library
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (sentences.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col">
        <StaticGoldenHourBackground />
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 gap-6">
          <div className="rounded-[14px] bg-[rgba(30,26,48,0.35)] backdrop-blur-[16px] px-10 py-8 border border-white/[0.08] flex flex-col items-center gap-6" style={{ WebkitBackdropFilter: "blur(16px)" }}>
            <BookOpen className="h-12 w-12 text-[#F5F0E6]/40" />
            <div className="text-center space-y-2">
              <p className="text-lg font-medium text-[#F5F0E6]">No sentences to review</p>
              <p className="text-sm text-[#F5F0E6]/50">
                Complete a review session to generate sentences first
              </p>
            </div>
            <Button variant="outline" onClick={onClose}>
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const sentence = sentences[currentIndex];

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <StaticGoldenHourBackground />
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-[rgba(30,26,48,0.5)] backdrop-blur-md" style={{ WebkitBackdropFilter: "blur(12px)" }}>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 text-[#F5F0E6]/60 hover:text-[#F5F0E6] transition-colors rounded-lg p-2 -ml-2"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
            <span className="text-sm font-medium hidden sm:inline">Close</span>
          </button>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#F0C88A]" />
            <span className="text-sm font-medium text-[#F0C88A]">Sentence Review</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-[#F5F0E6]/50">
            <span className="font-mono">{currentIndex + 1}</span>
            <span className="opacity-50">/</span>
            <span className="font-mono">{sentences.length}</span>
          </div>
        </header>

        {/* Progress dots */}
        <div className="flex-shrink-0 flex items-center justify-center gap-2 py-3 bg-[rgba(30,26,48,0.25)]">
          {sentences.map((s, i) => {
            const rated = !!ratings[s.id];
            return (
              <button
                key={s.id}
                onClick={() => { setDirection(i > currentIndex ? 1 : -1); setCurrentIndex(i); }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === currentIndex
                    ? "w-6 bg-[#F0C88A]"
                    : rated
                      ? "w-2 bg-emerald-400/70"
                      : "w-2 bg-white/15 hover:bg-white/25"
                }`}
                aria-label={`Sentence ${i + 1}${rated ? " (rated)" : ""}`}
              />
            );
          })}
        </div>

        {/* Sentence content */}
        <div className="flex-1 flex items-center justify-center px-4 pb-24 overflow-hidden min-h-0">
          <div
            className="flex items-center justify-center gap-1 sm:gap-2 md:gap-3 w-full max-w-5xl mx-auto"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Desktop prev */}
            <button
              type="button"
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="hidden md:flex items-center justify-center shrink-0 self-center h-11 w-11 rounded-full border border-white/[0.08] bg-[rgba(30,26,48,0.35)] backdrop-blur-md text-[#F5F0E6]/60 hover:text-[#F5F0E6] hover:border-white/20 transition-all duration-200 disabled:opacity-0 disabled:pointer-events-none"
              style={{ WebkitBackdropFilter: "blur(12px)" }}
              aria-label="Previous sentence"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
            </button>

            <div className="min-w-0 w-full max-w-[88vw] max-w-3xl grow md:grow-0">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={sentence.id}
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -60 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <div className="wild-golden-panel">
                    <SentenceDisplay
                      sentence={sentence}
                      showAddWord
                      showLegend
                      onRate={handleRate}
                      currentRating={ratings[sentence.id] || null}
                    />
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Desktop next */}
            <button
              type="button"
              onClick={goNext}
              disabled={currentIndex === sentences.length - 1}
              className="hidden md:flex items-center justify-center shrink-0 self-center h-11 w-11 rounded-full border border-white/[0.08] bg-[rgba(30,26,48,0.35)] backdrop-blur-md text-[#F5F0E6]/60 hover:text-[#F5F0E6] hover:border-white/20 transition-all duration-200 disabled:opacity-0 disabled:pointer-events-none"
              style={{ WebkitBackdropFilter: "blur(12px)" }}
              aria-label="Next sentence"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2.25} />
            </button>
          </div>
        </div>

        {/* Mobile bottom navigation */}
        <div className="fixed bottom-0 left-0 right-0 z-10 md:hidden">
          <div className="wild-nav-gradient-golden">
            <div className="flex items-center justify-between max-w-2xl mx-auto px-6 py-5">
              <Button
                variant="ghost"
                size="lg"
                onClick={goPrev}
                disabled={currentIndex === 0}
                className="h-12 w-12 rounded-full"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>

              {currentIndex === sentences.length - 1 ? (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={fetchRandomSentences}
                    className="h-12 w-12 rounded-full"
                    aria-label="Shuffle new sentences"
                  >
                    <Shuffle className="h-5 w-5" />
                  </Button>
                  <Button onClick={onClose} size="lg" className="h-12 px-8 rounded-full">
                    Done
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={goNext}
                  className="h-12 w-12 rounded-full"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Desktop finish area (shown on last sentence) */}
        {currentIndex === sentences.length - 1 && (
          <div className="hidden md:flex fixed bottom-6 left-0 right-0 z-10 justify-center gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={fetchRandomSentences}
              className="h-12 px-6 rounded-full shadow-lg gap-2"
            >
              <Shuffle className="h-4 w-4" />
              More Sentences
            </Button>
            <Button onClick={onClose} size="lg" className="h-12 px-8 rounded-full shadow-lg">
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
