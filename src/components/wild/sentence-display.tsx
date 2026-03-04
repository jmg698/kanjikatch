"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Plus, Check, Loader2 } from "lucide-react";
import type { WildSentenceData, WildWord } from "./in-the-wild";

interface SentenceDisplayProps {
  sentence: WildSentenceData;
  showAddWord?: boolean;
  compact?: boolean;
}

function WordToken({ word, onTapWord }: { word: WildWord; onTapWord?: (word: WildWord) => void }) {
  const isPunctuation = /^[。、！？「」『』（）\s…・ー～]+$/.test(word.text);

  if (isPunctuation) {
    return <span className="wild-punctuation">{word.text}</span>;
  }

  if (word.isTarget) {
    return (
      <span className="wild-target-word" role="mark">
        {word.text}
      </span>
    );
  }

  const hasReading = word.reading && word.reading !== word.text;
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

export function SentenceDisplay({ sentence, showAddWord = false, compact = false }: SentenceDisplayProps) {
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
      const res = await fetch("/api/vocabulary/quick-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: addingWord.text,
          reading: addingWord.reading || addingWord.text,
          meanings: ["(added from reading)"],
        }),
      });

      if (res.status === 409) {
        setAddStatus("success");
        setAddError("Already in your library!");
      } else if (!res.ok) {
        throw new Error("Failed to add");
      } else {
        setAddStatus("success");
      }
    } catch {
      setAddStatus("error");
      setAddError("Failed to add word");
    }
  }

  const targetItems = sentence.targets?.map((t) => t.itemText) || [];

  return (
    <div className={`space-y-6 ${compact ? "" : "py-4"}`}>
      {/* Target items badge row */}
      {!compact && targetItems.length > 0 && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {targetItems.map((item) => (
            <span
              key={item}
              className="inline-flex items-center px-3 py-1 rounded-full bg-amber-100/80 text-amber-800 text-sm font-medium dark:bg-amber-900/30 dark:text-amber-200"
            >
              {item}
            </span>
          ))}
        </div>
      )}

      {/* Japanese sentence */}
      <div className={`wild-sentence-text ${compact ? "text-xl" : "text-2xl sm:text-3xl"} leading-relaxed text-center`}>
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
              className="space-y-2"
            >
              <p className={`text-muted-foreground ${compact ? "text-sm" : "text-base sm:text-lg"}`}>
                {sentence.english}
              </p>
              <button
                onClick={() => setShowTranslation(false)}
                className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
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
              className="inline-flex items-center gap-2 text-sm text-muted-foreground/70 hover:text-muted-foreground transition-colors py-2 px-4 rounded-full hover:bg-muted/50"
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-lg">{addingWord.text}</p>
                  {addingWord.reading && (
                    <p className="text-sm text-muted-foreground">{addingWord.reading}</p>
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
