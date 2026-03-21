"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Home, BookOpen, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SentenceDisplay, type DifficultyRating } from "./sentence-display";

export interface WildWord {
  text: string;
  reading: string | null;
  isTarget: boolean;
  meaning?: string | null;
}

export interface WildSentenceTarget {
  id: string;
  sentenceId: string;
  itemType: string;
  itemId: string;
  itemText: string;
}

export interface WildSentenceData {
  id: string;
  japanese: string;
  english: string;
  words: WildWord[];
  targets: WildSentenceTarget[];
  difficultyRating: DifficultyRating | null;
  createdAt: string;
}

interface InTheWildProps {
  sessionId: string;
  onClose: () => void;
  onBackToDashboard: () => void;
}

export function InTheWild({ sessionId, onClose, onBackToDashboard }: InTheWildProps) {
  const [sentences, setSentences] = useState<WildSentenceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [ratings, setRatings] = useState<Record<string, DifficultyRating>>({});

  const handleRate = useCallback(async (sentenceId: string, rating: DifficultyRating) => {
    setRatings((prev) => ({ ...prev, [sentenceId]: rating }));

    try {
      await fetch("/api/sentences/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentenceId, rating }),
      });
    } catch {
      // Rating saved optimistically — silent fail is fine
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchSentences() {
      try {
        const res = await fetch("/api/sentences/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to generate sentences");
        }

        const data = await res.json();
        if (!cancelled) {
          const fetched: WildSentenceData[] = data.sentences || [];
          setSentences(fetched);
          const existingRatings: Record<string, DifficultyRating> = {};
          for (const s of fetched) {
            if (s.difficultyRating) existingRatings[s.id] = s.difficultyRating;
          }
          if (Object.keys(existingRatings).length > 0) setRatings(existingRatings);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Something went wrong");
          setLoading(false);
        }
      }
    }

    fetchSentences();
    return () => { cancelled = true; };
  }, [sessionId]);

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

    // Only trigger swipe if horizontal movement exceeds vertical (avoid interfering with scroll)
    if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        goNext();
      } else {
        goPrev();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  }, [goNext, goPrev]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <BookOpen className="h-12 w-12 text-primary opacity-60" />
        </motion.div>
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">Crafting your sentences...</p>
          <p className="text-sm text-muted-foreground">
            Creating natural Japanese using what you just reviewed
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <X className="h-12 w-12 text-muted-foreground opacity-40" />
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">Couldn&apos;t generate sentences</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
        <Button variant="outline" onClick={onBackToDashboard}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (sentences.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <BookOpen className="h-12 w-12 text-muted-foreground opacity-40" />
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">No sentences to show</p>
          <p className="text-sm text-muted-foreground">
            Review more items to unlock contextual sentences
          </p>
        </div>
        <Button variant="outline" onClick={onBackToDashboard}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const sentence = sentences[currentIndex];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg p-2 -ml-2"
          aria-label="Close"
        >
          <Home className="h-5 w-5" />
          <span className="text-sm font-medium hidden sm:inline">Done</span>
        </button>
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">See It In The Wild</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span className="font-mono">{currentIndex + 1}</span>
          <span className="opacity-50">/</span>
          <span className="font-mono">{sentences.length}</span>
        </div>
      </header>

      {/* Progress dots */}
      <div className="flex-shrink-0 flex items-center justify-center gap-2 py-3">
        {sentences.map((s, i) => {
          const rated = !!ratings[s.id];
          return (
            <button
              key={i}
              onClick={() => { setDirection(i > currentIndex ? 1 : -1); setCurrentIndex(i); }}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === currentIndex
                  ? "w-6 bg-primary"
                  : rated
                    ? "w-2 bg-emerald-400 dark:bg-emerald-500"
                    : "w-2 bg-border hover:bg-muted-foreground/30"
              }`}
              aria-label={`Sentence ${i + 1}${rated ? " (rated)" : ""}`}
            />
          );
        })}
      </div>

      {/* Sentence content — arrows sit beside the card, not at viewport edges */}
      <div className="flex-1 flex items-center justify-center px-4 pb-24 overflow-hidden min-h-0">
        <div
          className="flex items-center justify-center gap-1 sm:gap-2 md:gap-3 w-full max-w-5xl mx-auto"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Desktop prev — flush to sentence column */}
          <button
            type="button"
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="hidden md:flex items-center justify-center shrink-0 self-center h-11 w-11 rounded-full border-2 border-border bg-background/90 backdrop-blur-sm text-foreground/70 hover:text-foreground hover:border-primary/40 hover:bg-background shadow-sm transition-all duration-200 disabled:opacity-0 disabled:pointer-events-none"
            aria-label="Previous sentence"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
          </button>

          <div className="min-w-0 w-full max-w-2xl grow md:grow-0">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={sentence.id}
                custom={direction}
                initial={{ opacity: 0, x: direction * 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -60 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <SentenceDisplay
                  sentence={sentence}
                  showAddWord
                  onRate={handleRate}
                  currentRating={ratings[sentence.id] || null}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Desktop next */}
          <button
            type="button"
            onClick={goNext}
            disabled={currentIndex === sentences.length - 1}
            className="hidden md:flex items-center justify-center shrink-0 self-center h-11 w-11 rounded-full border-2 border-border bg-background/90 backdrop-blur-sm text-foreground/70 hover:text-foreground hover:border-primary/40 hover:bg-background shadow-sm transition-all duration-200 disabled:opacity-0 disabled:pointer-events-none"
            aria-label="Next sentence"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-10 md:hidden">
        <div className="wild-nav-gradient">
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
              <Button onClick={onBackToDashboard} size="lg" className="h-12 px-8 rounded-full">
                Finish Reading
              </Button>
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

      {/* Desktop finish button (shown on last sentence) */}
      {currentIndex === sentences.length - 1 && (
        <div className="hidden md:flex fixed bottom-6 left-0 right-0 z-10 justify-center">
          <Button onClick={onBackToDashboard} size="lg" className="h-12 px-8 rounded-full shadow-lg">
            Finish Reading
          </Button>
        </div>
      )}
    </div>
  );
}
