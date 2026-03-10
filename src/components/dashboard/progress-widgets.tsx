'use client';

import { useEffect, useRef } from 'react';

// ── XP Progress Bar ──────────────────────────────────────

interface XPBarProps {
  xpInLevel: number;
  xpForNext: number;
  level: number;
  totalXp: number;
}

export function XPBar({ xpInLevel, xpForNext, level, totalXp }: XPBarProps) {
  const pct = xpForNext > 0 ? Math.min(100, (xpInLevel / xpForNext) * 100) : 0;
  const barRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    const dot = dotRef.current;
    if (!bar || !dot) return;

    // Start collapsed at left edge
    bar.style.width = '0%';
    dot.style.left = '-7px';
    dot.style.opacity = '0';

    // Double rAF — lets browser paint the 0% state before animating
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
        bar.style.transition = `width 1.3s ${easing}`;
        dot.style.transition = `left 1.3s ${easing}, opacity 0.3s ease 0.2s`;
        bar.style.width = `${pct}%`;
        dot.style.left = `calc(${pct}% - 7px)`;
        dot.style.opacity = '1';
      });
    });
  }, [pct]);

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-serif font-bold text-gold">{totalXp}</span>
        <span className="text-sm text-muted-foreground">XP total</span>
        <span className="ml-auto text-xs text-muted-foreground font-mono">
          {xpInLevel} / {xpForNext} → Lv. {level + 1}
        </span>
      </div>

      {/* Bar track */}
      <div className="relative h-3 bg-stone-100 border border-stone-200 rounded-full overflow-visible">
        {/* Animated fill */}
        <div
          ref={barRef}
          className="absolute inset-y-0 left-0 rounded-full overflow-hidden"
          style={{
            width: '0%',
            background: 'linear-gradient(90deg, hsl(33 80% 40%), hsl(43 90% 58%))',
          }}
        >
          {/* Shimmer overlay */}
          <div className="xp-bar-shimmer" />
        </div>

        {/* Floating endpoint dot */}
        <div
          ref={dotRef}
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-md z-10"
          style={{
            left: '-7px',
            opacity: 0,
            background: 'hsl(43 90% 58%)',
          }}
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

    // Start from empty ring (full dashoffset)
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
        width="112"
        height="112"
        viewBox="0 0 100 100"
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Track ring */}
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="hsl(35 18% 90%)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* Progress ring */}
        <circle
          ref={circleRef}
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={complete ? 'hsl(150 60% 42%)' : 'hsl(152 100% 22%)'}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ}
        />
      </svg>

      {/* Centre label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-2xl font-serif font-bold leading-none"
          style={{ color: complete ? 'hsl(150 60% 42%)' : 'hsl(25 20% 12%)' }}
        >
          {done}
        </span>
        <span className="text-[11px] text-muted-foreground mt-0.5 font-mono">
          / {goal}
        </span>
        {complete && (
          <span className="text-[10px] font-bold mt-1" style={{ color: 'hsl(150 60% 42%)' }}>
            完了
          </span>
        )}
      </div>
    </div>
  );
}
