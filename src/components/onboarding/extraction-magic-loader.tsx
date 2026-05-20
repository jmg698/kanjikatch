"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

// Paced client-side reveal of an all-at-once extraction response. The API
// returns the full extraction in one shot; this component animates the
// individual kanji "lifting off" the source image one at a time. Acts as
// both a loading state (when extraction is still in flight) and a demo of
// what the app just did (after the response arrives).
//
// Used by both paths:
//  - sample fast-path: extraction is pre-baked; loader runs purely for feel
//  - own-photo path: loader runs concurrently with the real /api/extract
//    call, swapping its placeholder kanji list for the real one on response
//
// See ONBOARDING_PLAN.md Phase 2.1 / §Step 3.

const REVEAL_CADENCE_MS = 230; // tuned for "magic trick" rhythm
const MIN_TOTAL_MS = 4000;
const TICKER_SETTLE_DELAY_MS = 350;

interface Props {
  /** Path to the captured image. Public path or signed URL — anything that
   *  next/image can render. Null/empty if no image to show (text-only). */
  imagePath: string | null;
  /** Full extracted kanji list (just the characters). Reveal animates in
   *  order. If unknown at start (own-photo path waiting on API), pass an
   *  empty array and update via the ready flag below. */
  kanjiCharacters: string[];
  /** Total vocab count to surface in the ticker. */
  vocabCount: number;
  /** Set to true once the extraction call has resolved. The loader pauses
   *  the reveal until this flips true; if extraction was already done (sample
   *  path), pass true from the start. */
  ready: boolean;
  /** Fires after the reveal animation completes AND the minimum total
   *  duration has elapsed. The parent should swap to the confirmation view. */
  onComplete: () => void;
}

export function ExtractionMagicLoader({
  imagePath,
  kanjiCharacters,
  vocabCount,
  ready,
  onComplete,
}: Props) {
  const startedAtRef = useRef<number>(Date.now());
  const [revealed, setRevealed] = useState<number>(0);
  const [displayVocab, setDisplayVocab] = useState<number>(0);

  // Drive the kanji reveal once we know what to reveal.
  useEffect(() => {
    if (!ready || kanjiCharacters.length === 0) return;
    if (revealed >= kanjiCharacters.length) return;

    const id = window.setTimeout(() => {
      setRevealed((n) => n + 1);
    }, REVEAL_CADENCE_MS);
    return () => window.clearTimeout(id);
  }, [ready, kanjiCharacters.length, revealed]);

  // Let vocab tick up after the kanji reveal finishes so the two counters
  // don't race. Cosmetic; the user reads kanji first.
  useEffect(() => {
    if (!ready) return;
    if (revealed < kanjiCharacters.length) return;
    if (displayVocab >= vocabCount) return;
    const id = window.setTimeout(() => {
      setDisplayVocab((n) => Math.min(n + 1, vocabCount));
    }, 90);
    return () => window.clearTimeout(id);
  }, [ready, revealed, kanjiCharacters.length, displayVocab, vocabCount]);

  // Fire onComplete once both counters have caught up AND the minimum
  // duration has passed. Without the floor a fast sample path would zip
  // through too quickly to read.
  useEffect(() => {
    if (!ready) return;
    if (revealed < kanjiCharacters.length) return;
    if (displayVocab < vocabCount) return;

    const elapsed = Date.now() - startedAtRef.current;
    const remaining = Math.max(0, MIN_TOTAL_MS - elapsed) + TICKER_SETTLE_DELAY_MS;
    const id = window.setTimeout(onComplete, remaining);
    return () => window.clearTimeout(id);
  }, [ready, revealed, kanjiCharacters.length, displayVocab, vocabCount, onComplete]);

  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
        02 / 03 · 拾
      </p>
      <h1 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight leading-[1.1]">
        Catching every word…
      </h1>
      <p className="mt-2 text-base text-muted-foreground">
        Pulling kanji and vocabulary off the page.
      </p>

      <div className="mt-6 relative rounded-xl border bg-white overflow-hidden" style={{ borderColor: "hsl(35 15% 86%)" }}>
        {imagePath ? (
          <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
            <Image
              src={imagePath}
              alt="Captured page"
              fill
              className="object-cover opacity-70 transition-opacity"
              sizes="(max-width: 768px) 100vw, 672px"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-white/85 via-white/10 to-transparent" />
          </div>
        ) : (
          <div
            className="w-full flex items-center justify-center"
            style={{ aspectRatio: "16 / 9", background: "hsl(35 30% 96%)" }}
          >
            <p className="text-sm text-muted-foreground italic">
              Working on your text…
            </p>
          </div>
        )}

        <div className="px-5 py-4 border-t flex flex-wrap items-baseline gap-x-5 gap-y-2" style={{ borderColor: "hsl(35 15% 92%)" }}>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tabular-nums">
              {revealed}
            </span>
            <span className="text-xs text-muted-foreground">kanji caught</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tabular-nums">
              {displayVocab}
            </span>
            <span className="text-xs text-muted-foreground">words found</span>
          </div>
          {!ready && (
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70 ml-auto">
              still reading…
            </span>
          )}
        </div>
      </div>

      {/* Lift-off row: kanji animate in one at a time from the image above. */}
      <div className="mt-6 min-h-[80px] flex flex-wrap gap-2 justify-center">
        <AnimatePresence>
          {kanjiCharacters.slice(0, revealed).map((char, i) => (
            <motion.span
              key={`${char}-${i}`}
              initial={{ opacity: 0, y: -16, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
              className="font-serif text-3xl sm:text-4xl px-3 py-1.5 rounded-lg bg-white border shadow-sm"
              style={{
                borderColor: "hsl(35 18% 84%)",
                boxShadow: "0 8px 16px -10px rgba(60, 50, 40, 0.25)",
              }}
            >
              {char}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
