"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

// The loop, made literal: the same word (駅) travels photo → extracted
// entry → review card → wild sentence, then a dashed path curves back to
// the start. The one-minute gap between the two timestamps (08:12 → 08:13)
// IS the setup-time claim — no other timestamps appear on the page.

const GOLD = "hsl(45 100% 72% / 0.55)";

export function LoopStrip() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduceMotion = useReducedMotion();

  const play = inView;
  const t = (delay: number, duration = 0.25) =>
    reduceMotion
      ? { duration: 0 }
      : { duration, ease: "easeOut" as const, delay };

  const step = (i: number) => ({
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 },
    animate: play ? { opacity: 1, y: 0 } : {},
    transition: t(i * 0.1),
  });

  return (
    <div ref={ref} className="mt-14 max-w-5xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10 md:gap-8">
        {/* 01 — Snap */}
        <motion.div {...step(0)} className="flex flex-col">
          <StepHeader n="01" kanji="撮" name="Snap" stamp="08:12" />
          <div className="mt-4 relative">
            <div
              className="relative -rotate-2 bg-card border border-border rounded-md shadow-sm px-3 py-2 overflow-hidden"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(transparent 0 26px, hsl(35 15% 90%) 26px 27px)",
              }}
            >
              <span className="font-serif text-3xl leading-relaxed">駅</span>
              <span className="ml-2 font-serif text-sm text-foreground/60">
                で降りる…
              </span>
              {/* Extraction scan-band — the OCR claim demonstrated, not asserted */}
              <motion.div
                aria-hidden
                initial={{ scaleX: 0 }}
                animate={play && !reduceMotion ? { scaleX: [0, 1, 1], opacity: [1, 1, 0] } : {}}
                transition={{ duration: 0.9, ease: "easeOut", delay: 0.9, times: [0, 0.45, 1] }}
                className="absolute inset-0 origin-left pointer-events-none"
                style={{ background: GOLD }}
              />
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            a photo of what you&apos;re reading
          </p>
        </motion.div>

        {/* 02 — Catch */}
        <motion.div {...step(1)} className="flex flex-col">
          <StepHeader n="02" kanji="拾" name="Catch" stamp="08:13" />
          <div className="mt-4 bg-card border border-border rounded-md shadow-sm px-3 py-2.5">
            <p className="font-mono text-sm tabular-nums">
              {(
                [
                  ["駅", 1.45],
                  ["えき", 1.6],
                  ["station", 1.75],
                ] as const
              ).map(([text, delay], i) => (
                <motion.span
                  key={text}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  animate={play ? { opacity: 1, y: 0 } : {}}
                  transition={t(delay, 0.15)}
                  className="inline-block"
                >
                  {i > 0 && <span className="text-muted-foreground/60 mx-1.5">·</span>}
                  {text}
                </motion.span>
              ))}
            </p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={play ? { opacity: 1 } : {}}
              transition={t(1.95, 0.2)}
              className="mt-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium"
            >
              auto-filled · editable
            </motion.p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            readings and meanings, filled in
          </p>
        </motion.div>

        {/* 03 — Master */}
        <motion.div {...step(2)} className="flex flex-col">
          <StepHeader n="03" kanji="覚" name="Master" />
          <div className="mt-4 mx-auto md:mx-0 w-24 bg-card border border-border rounded-lg shadow-sm px-3 pt-3 pb-2 text-center">
            <span className="font-bold text-2xl leading-none">駅</span>
            <div className="mt-2 border-t-2 border-dashed border-border pt-1.5">
              <span className="inline-block rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-medium px-1.5 py-0.5">
                Good
              </span>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            scheduled until it sticks
          </p>
        </motion.div>

        {/* 04 — Read */}
        <motion.div {...step(3)} className="flex flex-col">
          <StepHeader n="04" kanji="読" name="Read" />
          <div className="mt-4 bg-card border border-border rounded-md shadow-sm px-3 py-2.5">
            <p className="wild-sentence-text text-lg">
              <span className="wild-studied-word">駅</span>で
              <span className="text-muted-foreground">…</span>
            </p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            back to you in fresh sentences
          </p>
        </motion.div>
      </div>

      {/* Return path — step 04 feeds step 01 */}
      <div className="relative mt-10 hidden md:block" aria-hidden>
        <svg viewBox="0 0 800 64" fill="none" className="w-full h-16">
          <motion.path
            d="M 764 10 C 690 58, 110 58, 36 10"
            stroke="hsl(35 15% 78%)"
            strokeWidth="2"
            strokeDasharray="4 6"
            initial={{ pathLength: 0 }}
            animate={play ? { pathLength: 1 } : {}}
            transition={t(1.6, reduceMotion ? 0 : 0.4)}
          />
          <motion.path
            d="M 44 22 L 36 10 L 50 12"
            stroke="hsl(35 15% 78%)"
            strokeWidth="2"
            initial={{ opacity: 0 }}
            animate={play ? { opacity: 1 } : {}}
            transition={t(2.0, 0.2)}
          />
        </svg>
        <motion.p
          initial={{ opacity: 0 }}
          animate={play ? { opacity: 1 } : {}}
          transition={t(1.9, 0.25)}
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-display text-lg text-foreground"
        >
          That&apos;s the loop.
        </motion.p>
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={play ? { opacity: 1 } : {}}
        transition={t(0.5, 0.25)}
        className="mt-8 md:hidden text-center font-display text-lg"
      >
        That&apos;s the loop.
      </motion.p>
    </div>
  );
}

function StepHeader({
  n,
  kanji,
  name,
  stamp,
}: {
  n: string;
  kanji: string;
  name: string;
  stamp?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-xs text-muted-foreground">{n}</span>
        <span className="font-sans text-4xl font-bold text-primary leading-none">
          {kanji}
        </span>
        <span className="font-display text-xl font-medium">{name}</span>
      </div>
      {stamp && (
        <span className="font-mono tabular-nums text-xs text-muted-foreground bg-secondary rounded px-1.5 py-0.5">
          {stamp}
        </span>
      )}
    </div>
  );
}
