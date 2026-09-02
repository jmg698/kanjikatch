"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

// A real, playable review rep. Autoplays one full cycle loop until the
// visitor touches it — then control is theirs and is never taken back.
// The three cards here are the same words the wild-sentence demo renders
// later on the page: 駅 and 乗り換え show as studied (gold), and 急行 —
// graded "Hard" below — resurfaces as a teal partial. The page enacts the
// product's loop on the visitor.

type GradeKey = "again" | "hard" | "good" | "easy";

const GRADE_STYLES: Record<GradeKey, string> = {
  again: "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100",
  hard: "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100",
  good: "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100",
  easy: "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100",
};

const GRADE_HINT: Record<GradeKey, string> = {
  again: "Forgot completely",
  hard: "Barely remembered",
  good: "Knew it",
  easy: "Knew instantly",
};

const FLASH_CLASS: Record<GradeKey, string> = {
  again: "bg-orange-500",
  hard: "bg-amber-500",
  good: "bg-emerald-500",
  easy: "bg-indigo-500",
};

const GRADES: GradeKey[] = ["again", "hard", "good", "easy"];

interface DemoCard {
  label: string;
  prompt: string;
  promptClass: string;
  // [text, reading?] segments so mixed kana/kanji words get correct ruby.
  ruby: Array<[string, string?]>;
  meaning: string;
  autoGrade: GradeKey;
}

const DECK: DemoCard[] = [
  {
    label: "Kanji",
    prompt: "駅",
    promptClass: "text-8xl",
    ruby: [["駅", "えき"]],
    meaning: "station",
    autoGrade: "good",
  },
  {
    label: "Vocabulary",
    prompt: "乗り換え",
    promptClass: "text-6xl lg:text-7xl",
    ruby: [["乗", "の"], ["り"], ["換", "か"], ["え"]],
    meaning: "transfer",
    autoGrade: "good",
  },
  {
    label: "Vocabulary",
    prompt: "急行",
    promptClass: "text-6xl lg:text-7xl",
    ruby: [["急行", "きゅうこう"]],
    meaning: "express train",
    autoGrade: "hard",
  },
];

export function HeroReviewDemo({
  ctaHref,
  ctaLabel,
}: {
  ctaHref: string;
  ctaLabel: string;
}) {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { amount: 0.5 });

  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pressedGrade, setPressedGrade] = useState<GradeKey | null>(null);
  const [flash, setFlash] = useState<GradeKey | null>(null);
  const [graded, setGraded] = useState(0);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [complete, setComplete] = useState(false);
  const [docVisible, setDocVisible] = useState(true);

  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);

  // Reduced motion: no autoplay — render card 1 revealed and hand over control.
  useEffect(() => {
    if (reduceMotion) {
      clearTimers();
      setMode("manual");
      setRevealed(true);
    }
  }, [reduceMotion, clearTimers]);

  useEffect(() => {
    function onVisibility() {
      setDocVisible(!document.hidden);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // The never-take-back rule: first interaction cancels autoplay for good.
  const takeOver = useCallback(() => {
    setMode((current) => {
      if (current === "auto") clearTimers();
      return "manual";
    });
  }, [clearTimers]);

  // Autoplay driver. Resumes from the current visual phase so pausing
  // (scrolled away, tab hidden) never replays a step already seen.
  useEffect(() => {
    if (mode !== "auto" || !inView || !docVisible || reduceMotion || complete) return;

    const card = DECK[cardIndex];
    const doReveal = () => setRevealed(true);
    const doPress = () => {
      setPressedGrade(card.autoGrade);
      setFlash(card.autoGrade);
      schedule(() => setFlash(null), 400);
    };
    const doTick = () => setGraded(cardIndex + 1);
    const doAdvance = () => {
      setRevealed(false);
      setPressedGrade(null);
      if (cardIndex === DECK.length - 1) setGraded(0);
      setCardIndex((i) => (i + 1) % DECK.length);
    };

    if (!revealed) {
      schedule(doReveal, 1600);
      schedule(doPress, 3200);
      schedule(doTick, 3700);
      schedule(doAdvance, 3950);
    } else if (!pressedGrade) {
      schedule(doPress, 1600);
      schedule(doTick, 2100);
      schedule(doAdvance, 2350);
    } else {
      schedule(doTick, 500);
      schedule(doAdvance, 750);
    }

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, inView, docVisible, cardIndex, reduceMotion, complete]);

  const gradeManual = useCallback(
    (g: GradeKey) => {
      if (!revealed || complete) return;
      takeOver();
      setPressedGrade(g);
      setFlash(g);
      setGraded(cardIndex + 1);
      schedule(() => setFlash(null), 400);
      schedule(() => {
        if (cardIndex === DECK.length - 1) {
          setComplete(true);
        } else {
          setRevealed(false);
          setPressedGrade(null);
          setCardIndex(cardIndex + 1);
        }
      }, 450);
    },
    [revealed, complete, cardIndex, takeOver, schedule],
  );

  const revealManual = useCallback(() => {
    takeOver();
    setRevealed(true);
  }, [takeOver]);

  // Keyboard: live while the demo is in view. Space reveals (or grades Good
  // once revealed), Enter reveals, 1–4 grade. preventDefault only on handled keys.
  useEffect(() => {
    if (!inView || complete) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        revealManual();
        return;
      }
      if (revealed) {
        if (e.key === " ") {
          e.preventDefault();
          gradeManual("good");
          return;
        }
        const idx = ["1", "2", "3", "4"].indexOf(e.key);
        if (idx !== -1) {
          e.preventDefault();
          gradeManual(GRADES[idx]);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inView, complete, revealed, revealManual, gradeManual]);

  const card = DECK[cardIndex];
  const counter = complete ? DECK.length : Math.min(graded + 1, DECK.length);
  const progressPct = (complete ? 1 : graded / DECK.length) * 100;

  return (
    <div ref={containerRef} className="w-full">
      <div
        role="group"
        tabIndex={0}
        aria-label="Interactive review demo — press Space to reveal, 1 to 4 to grade"
        onFocusCapture={takeOver}
        className="dash-facade relative cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onPointerDown={() => {
          takeOver();
          if (!revealed && !complete) setRevealed(true);
        }}
      >
        {/* Grade flash — identical values simulated and real */}
        <AnimatePresence>
          {flash && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.08 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={`absolute inset-0 z-20 pointer-events-none ${FLASH_CLASS[flash]}`}
            />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false}>
          {complete ? (
            <motion.div
              key="complete"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="p-6 sm:p-7"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Session complete
                </span>
                <span className="font-mono tabular-nums text-xs text-muted-foreground">
                  {DECK.length}/{DECK.length}
                </span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className="h-full w-full bg-primary rounded-full" />
              </div>
              <div className="py-10 text-center space-y-5">
                <p className="font-display text-2xl font-medium">
                  Nice work — that&apos;s a wrap.
                </p>
                <Link href={ctaHref} className="start-review-cta [animation:none] active:scale-[0.99] group">
                  {ctaLabel}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={cardIndex}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeOut" }}
              className="p-6 sm:p-7"
            >
              {/* Chrome */}
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  {card.label}
                </span>
                <span className="font-mono tabular-nums text-xs text-muted-foreground">
                  {counter}/{DECK.length}
                </span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={false}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                />
              </div>

              {/* Prompt */}
              <div className="py-10 text-center">
                <div className={`font-bold leading-none ${card.promptClass}`}>
                  {card.prompt}
                </div>
                {!revealed && (
                  <motion.p
                    className="mt-6 text-sm text-muted-foreground"
                    animate={reduceMotion ? undefined : { opacity: [0.4, 0.7, 0.4] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    tap to reveal
                  </motion.p>
                )}
              </div>

              {/* Answer past the tear-line */}
              <AnimatePresence initial={false}>
                {revealed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.3, ease: "easeOut" }}
                    className="overflow-hidden border-t-2 border-dashed border-border"
                  >
                    <div className="min-h-[104px] py-5 text-center space-y-1.5">
                      <p className="wild-ruby text-2xl font-semibold">
                        {card.ruby.map(([text, reading], i) =>
                          reading ? (
                            <ruby key={i}>
                              {text}
                              <rt className="text-[0.5em] font-normal text-muted-foreground">
                                {reading}
                              </rt>
                            </ruby>
                          ) : (
                            <span key={i}>{text}</span>
                          ),
                        )}
                      </p>
                      <p className="text-muted-foreground">{card.meaning}</p>
                      {cardIndex === 2 && (
                        <p className="pt-2 text-xs text-muted-foreground">
                          Showing up for the hard ones is the work.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Grade tiles */}
              <AnimatePresence initial={false}>
                {revealed && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: reduceMotion ? 0 : 0.25,
                      ease: "easeOut",
                      delay: reduceMotion ? 0 : 0.15,
                    }}
                    className="grid grid-cols-4 gap-2"
                  >
                    {GRADES.map((g) => (
                      <motion.button
                        key={g}
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => gradeManual(g)}
                        aria-label={`${g} — ${GRADE_HINT[g]}`}
                        title={GRADE_HINT[g]}
                        animate={
                          pressedGrade === g && !reduceMotion
                            ? { scale: [1, 0.95, 1] }
                            : { scale: 1 }
                        }
                        transition={{ duration: 0.24, times: [0, 0.5, 1] }}
                        className={`rounded-xl border py-2.5 text-sm font-medium capitalize transition-colors active:scale-95 ${GRADE_STYLES[g]}`}
                      >
                        {g}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Keyboard proof — the chips genuinely work */}
      <div
        className={`mt-4 ml-auto w-fit hidden lg:flex items-center gap-2 text-xs text-foreground/70 bg-background/75 backdrop-blur-sm rounded-lg px-2.5 py-1.5 transition-opacity duration-200 ${
          mode === "manual" ? "opacity-100" : "opacity-70"
        }`}
      >
        <kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs font-mono">Space</kbd>
        <span>reveal</span>
        <span className="opacity-40">·</span>
        <kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs font-mono">1</kbd>
        <span>–</span>
        <kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs font-mono">4</kbd>
        <span>grade</span>
      </div>
      <p className="mt-4 lg:hidden text-right font-mono text-xs text-muted-foreground/80">
        tap to try
      </p>
    </div>
  );
}
