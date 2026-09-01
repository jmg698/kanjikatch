"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";

// The wild-sentence demo continues the hero demo's story: 駅 and 乗り換えた
// render as studied (gold) because the visitor just reviewed them; 急行 —
// the card graded "Hard" moments ago — renders as a teal partial. The page
// rereads its own review history, the way the product does.

const GOLD_BAND =
  "linear-gradient(180deg, transparent 55%, hsl(45 100% 72% / 0.55) 55%, hsl(45 100% 72% / 0.55) 90%, transparent 90%)";

function StudiedWord({
  play,
  delay,
  reduceMotion,
  children,
}: {
  play: boolean;
  delay: number;
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="relative inline-block font-medium px-px">
      <motion.span
        aria-hidden
        className="absolute inset-0 origin-left rounded-[2px]"
        style={{ background: GOLD_BAND }}
        initial={{ scaleX: 0 }}
        animate={play ? { scaleX: 1 } : {}}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 0.25, ease: "easeOut", delay }
        }
      />
      <span className="relative">{children}</span>
    </span>
  );
}

export function WildDemo({ ctaHref }: { ctaHref: string }) {
  const reduceMotion = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });

  const [revealed, setRevealed] = useState(false);
  const [caught, setCaught] = useState(false);
  const [toast, setToast] = useState(false);
  const toastTimer = useRef<number | null>(null);

  // Reduced motion: everything pre-painted, translation pre-revealed.
  useEffect(() => {
    if (reduceMotion) setRevealed(true);
  }, [reduceMotion]);

  const reveal = useCallback(() => setRevealed(true), []);

  const catchWord = useCallback(() => {
    if (caught) return; // one-shot — it's in your deck now
    setCaught(true);
    setToast(true);
    toastTimer.current = window.setTimeout(() => setToast(false), 2400);
  }, [caught]);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  // Enter / ⌘↵ / Ctrl+Enter reveal, once the demo has been seen.
  useEffect(() => {
    if (!inView || revealed) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Enter") {
        e.preventDefault();
        reveal();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inView, revealed, reveal]);

  const play = inView || reduceMotion;

  return (
    <div ref={ref}>
      <div
        role="group"
        tabIndex={0}
        aria-label="Interactive reading demo — press Enter to reveal the translation"
        onClick={reveal}
        className="jr-panel rounded-2xl p-6 sm:p-8 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        style={{
          boxShadow:
            "0 20px 40px -20px rgba(60, 50, 40, 0.22), 0 8px 16px -8px rgba(60, 50, 40, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
        }}
      >
        {/* Chrome: pips + legend */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2" aria-hidden>
            <span className="h-1.5 w-8 rounded-full bg-primary" />
            <span className="h-1.5 w-8 rounded-full bg-primary" />
            <motion.span
              className="h-1.5 w-8 rounded-full"
              initial={false}
              animate={{
                backgroundColor: caught ? "hsl(152 100% 22%)" : "hsl(35 18% 92%)",
              }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            />
          </div>
          <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(45_100%_55%)]" />
            studied
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(176_55%_42%)] ml-2" />
            partial
          </span>
        </div>

        {/* The sentence */}
        <p className="wild-sentence-text text-2xl md:text-3xl">
          <StudiedWord play={play} delay={0} reduceMotion={reduceMotion}>
            <ruby className="wild-ruby">
              駅<rt>えき</rt>
            </ruby>
          </StudiedWord>
          で
          <motion.span
            className="wild-partial-word"
            initial={{ borderBottomColor: "hsla(176, 55%, 42%, 0)" }}
            animate={play ? { borderBottomColor: "hsla(176, 55%, 42%, 0.65)" } : {}}
            transition={
              reduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut", delay: 0.35 }
            }
          >
            <ruby className="wild-ruby">
              急行<rt>きゅうこう</rt>
            </ruby>
          </motion.span>
          を
          <ruby className="wild-ruby">
            降<rt>お</rt>
          </ruby>
          りて<span className="wild-punctuation">、</span>
          <span className="relative inline-block">
            <AnimatePresence>
              {toast && (
                <motion.span
                  role="status"
                  aria-live="polite"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 flex items-center gap-1.5 w-max max-w-[min(240px,80vw)] bg-card border border-border rounded-lg px-3 py-2 text-sm font-sans"
                  style={{ boxShadow: "0 8px 16px -8px rgba(60, 50, 40, 0.2)" }}
                >
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Caught. It&apos;ll be in tomorrow&apos;s review.</span>
                </motion.span>
              )}
            </AnimatePresence>
            {caught ? (
              <StudiedWord play delay={0} reduceMotion={reduceMotion}>
                <ruby className="wild-ruby">
                  終電<rt>しゅうでん</rt>
                </ruby>
              </StudiedWord>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  catchWord();
                }}
                aria-label="Catch 終電"
                className="border-b border-dotted border-muted-foreground/50 hover:bg-secondary rounded-sm active:scale-95 transition-transform"
              >
                <ruby className="wild-ruby">
                  終電<rt>しゅうでん</rt>
                </ruby>
              </button>
            )}
          </span>
          に
          <StudiedWord play={play} delay={0.1} reduceMotion={reduceMotion}>
            <ruby className="wild-ruby">
              乗<rt>の</rt>
            </ruby>
            り
            <ruby className="wild-ruby">
              換<rt>か</rt>
            </ruby>
            えた
          </StudiedWord>
          <span className="wild-punctuation">。</span>
        </p>

        {/* Translation past the tear-line */}
        <div className="mt-6 pt-5 border-t-2 border-dashed border-border">
          {revealed ? (
            <motion.p
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="text-muted-foreground italic"
            >
              At the station I got off the express and transferred to the last
              train.
            </motion.p>
          ) : (
            <motion.p
              className="text-sm text-muted-foreground"
              animate={reduceMotion ? undefined : { opacity: [0.4, 0.7, 0.4] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              tap to reveal
              <span className="hidden md:inline-flex items-center gap-1 ml-2">
                <kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs font-mono">⌘</kbd>
                <kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs font-mono">↵</kbd>
              </span>
            </motion.p>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Link
          href={ctaHref}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary"
        >
          Catch these, then review.
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
