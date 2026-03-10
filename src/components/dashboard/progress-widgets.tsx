'use client';

import { useEffect, useRef } from 'react';

// ── XP Progress Bar (Ink Brushstroke) ─────────────────────

interface XPBarProps {
  xpInLevel: number;
  xpForNext: number;
  level: number;
  totalXp: number;
}

export function XPBar({ xpInLevel, xpForNext, level, totalXp }: XPBarProps) {
  const pct = xpForNext > 0 ? Math.min(100, (xpInLevel / xpForNext) * 100) : 0;
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    bar.style.width = '0%';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bar.style.transition = 'width 1.4s cubic-bezier(0.22, 1, 0.36, 1)';
        bar.style.width = `${pct}%`;
      });
    });
  }, [pct]);

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl font-display font-bold" style={{ color: 'hsl(25 30% 22%)' }}>
          {totalXp}
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">XP</span>
        <span className="ml-auto text-xs text-muted-foreground font-mono">
          {xpInLevel} / {xpForNext} → Lv. {level + 1}
        </span>
      </div>

      {/* Ink-style bar track */}
      <div className="ink-bar-track">
        <div
          ref={barRef}
          className="ink-bar-fill"
          style={{ width: '0%' }}
        />
      </div>
    </div>
  );
}

// ── Daily Goal Ring ──────────────────────────────────────

interface DailyRingProps {
  done: number;
  goal: number;
}

export function DailyRing({ done, goal }: DailyRingProps) {
  const pct = goal > 0 ? Math.min(1, done / goal) : 0;
  const r = 42;
  const circ = 2 * Math.PI * r;
  const targetOffset = circ * (1 - pct);
  const complete = done >= goal;

  const circleRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const circle = circleRef.current;
    if (!circle) return;

    circle.style.strokeDashoffset = String(circ);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        circle.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(0.22, 1, 0.36, 1)';
        circle.style.strokeDashoffset = String(targetOffset);
      });
    });
  }, [circ, targetOffset]);

  return (
    <div className="relative flex items-center justify-center">
      <svg
        width="104"
        height="104"
        viewBox="0 0 100 100"
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Track ring — warm cream */}
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="hsl(35 20% 90%)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Progress ring — sumi ink */}
        <circle
          ref={circleRef}
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={complete ? 'hsl(150 45% 38%)' : 'hsl(25 30% 25%)'}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ}
        />
      </svg>

      {/* Centre label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-xl font-display font-bold leading-none"
          style={{ color: complete ? 'hsl(150 45% 38%)' : 'hsl(25 20% 12%)' }}
        >
          {done}
        </span>
        <span className="text-[10px] text-muted-foreground mt-0.5 font-mono">
          / {goal}
        </span>
        {complete && (
          <span className="text-[10px] font-bold mt-1" style={{ color: 'hsl(150 45% 38%)' }}>
            完了
          </span>
        )}
      </div>
    </div>
  );
}
