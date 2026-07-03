"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Throwaway font lab. Lets you "try on" fonts against real KanjiKatch UI copy
 * and pick a combination. Each slot maps to a Tailwind fontFamily slot backed by
 * a CSS variable (see tailwind.config.ts + globals.css :root), so selecting a
 * font here overrides it live across the whole app.
 *
 * When you settle on a combo, copy the generated snippet at the bottom into
 * globals.css (the :root font vars + the @import line), then delete this route,
 * the /font-lab public entry in middleware.ts, and (optionally) revert nothing
 * else — the CSS-variable slots are a keeper.
 */

type Candidate = { name: string; q: string };

// q = the css2 query fragment (weights validated as available on Google Fonts).
const CANDIDATES: Record<Slot, Candidate[]> = {
  display: [
    { name: "Fraunces", q: "family=Fraunces:opsz,wght@9..144,300;9..144,500;9..144,700" },
    { name: "Playfair Display", q: "family=Playfair+Display:wght@400;500;700" },
    { name: "DM Serif Display", q: "family=DM+Serif+Display" },
    { name: "Cormorant", q: "family=Cormorant:wght@400;500;600" },
    { name: "Libre Baskerville", q: "family=Libre+Baskerville:wght@400;700" },
    { name: "Spectral", q: "family=Spectral:wght@400;500;700" },
    { name: "Shippori Mincho", q: "family=Shippori+Mincho:wght@400;700;800" },
    { name: "Zen Old Mincho", q: "family=Zen+Old+Mincho:wght@400;700;900" },
  ],
  sans: [
    { name: "Noto Sans JP", q: "family=Noto+Sans+JP:wght@400;500;700" },
    { name: "Inter", q: "family=Inter:wght@400;500;700" },
    { name: "Zen Kaku Gothic New", q: "family=Zen+Kaku+Gothic+New:wght@400;500;700" },
    { name: "M PLUS Rounded 1c", q: "family=M+PLUS+Rounded+1c:wght@400;500;700" },
    { name: "Murecho", q: "family=Murecho:wght@400;500;700" },
    { name: "Figtree", q: "family=Figtree:wght@400;500;700" },
    { name: "IBM Plex Sans JP", q: "family=IBM+Plex+Sans+JP:wght@400;500;700" },
  ],
  serif: [
    { name: "Noto Serif JP", q: "family=Noto+Serif+JP:wght@400;600;700" },
    { name: "Shippori Mincho", q: "family=Shippori+Mincho:wght@400;700;800" },
    { name: "Zen Old Mincho", q: "family=Zen+Old+Mincho:wght@400;700;900" },
    { name: "Klee One", q: "family=Klee+One:wght@400;600" },
    { name: "BIZ UDPMincho", q: "family=BIZ+UDPMincho:wght@400;700" },
    { name: "Cormorant Garamond", q: "family=Cormorant+Garamond:wght@400;500;600" },
  ],
  mono: [
    { name: "JetBrains Mono", q: "family=JetBrains+Mono:wght@400;500;700" },
    { name: "Space Mono", q: "family=Space+Mono:wght@400;700" },
    { name: "IBM Plex Mono", q: "family=IBM+Plex+Mono:wght@400;500;700" },
    { name: "Fira Code", q: "family=Fira+Code:wght@400;500;700" },
    { name: "Source Code Pro", q: "family=Source+Code+Pro:wght@400;500;700" },
    { name: "Noto Sans Mono", q: "family=Noto+Sans+Mono:wght@400;500;700" },
  ],
};

type Slot = "display" | "sans" | "serif" | "mono";

const SLOTS: { key: Slot; label: string; blurb: string }[] = [
  { key: "display", label: "Display", blurb: "Headings & hero titles · font-display" },
  { key: "sans", label: "Body (Sans)", blurb: "Default body text · font-sans" },
  { key: "serif", label: "Serif", blurb: "Japanese serif accents · font-serif" },
  { key: "mono", label: "Mono", blurb: "Kanji, numbers, labels · font-mono" },
];

// Defaults mirror globals.css :root.
const DEFAULTS: Record<Slot, string> = {
  display: "Fraunces",
  sans: "Noto Sans JP",
  serif: "Noto Serif JP",
  mono: "JetBrains Mono",
};

export default function FontLabPage() {
  const [choice, setChoice] = useState<Record<Slot, string>>(DEFAULTS);

  // Load every candidate font (one <link> per family so a bad spec can't break
  // the others). Cleanup on unmount so we don't leak <link>s across navigations.
  useEffect(() => {
    const seen = new Set<string>();
    const links: HTMLLinkElement[] = [];
    (Object.keys(CANDIDATES) as Slot[]).forEach((slot) => {
      CANDIDATES[slot].forEach((c) => {
        if (seen.has(c.q)) return;
        seen.add(c.q);
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?${c.q}&display=swap`;
        document.head.appendChild(link);
        links.push(link);
      });
    });
    return () => links.forEach((l) => l.remove());
  }, []);

  // Apply choices live by overriding the CSS variables on :root.
  useEffect(() => {
    const root = document.documentElement;
    (Object.keys(choice) as Slot[]).forEach((slot) => {
      root.style.setProperty(`--font-${slot}`, `'${choice[slot]}'`);
    });
    return () => {
      (Object.keys(choice) as Slot[]).forEach((slot) => {
        root.style.removeProperty(`--font-${slot}`);
      });
    };
  }, [choice]);

  const snippet = useMemo(() => {
    const qFor = (slot: Slot) =>
      CANDIDATES[slot].find((c) => c.name === choice[slot])?.q ?? "";
    const importUrl =
      "@import url('https://fonts.googleapis.com/css2?" +
      SLOTS.map((s) => qFor(s.key)).join("&") +
      "&display=swap');";
    const rootBlock = [
      "  :root {",
      `    --font-sans: '${choice.sans}';`,
      `    --font-serif: '${choice.serif}';`,
      `    --font-display: '${choice.display}';`,
      `    --font-mono: '${choice.mono}';`,
      "  }",
    ].join("\n");
    return `/* 1. Replace the @import at the top of src/app/globals.css: */\n${importUrl}\n\n/* 2. Update the font vars in the :root block of src/app/globals.css: */\n${rootBlock}`;
  }, [choice]);

  const isDefault = SLOTS.every((s) => choice[s.key] === DEFAULTS[s.key]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            KanjiKatch · dev tool
          </p>
          <h1 className="font-display text-4xl font-bold text-ink">Font Lab</h1>
          <p className="mt-2 max-w-2xl font-sans text-muted-foreground">
            Try fonts on against real UI copy. Pick a font for each slot below — the
            whole page (and app) updates live. When you like a combo, copy the snippet
            at the bottom into <code className="font-mono text-sm">globals.css</code>.
          </p>
        </header>

        {/* Controls */}
        <section className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SLOTS.map((s) => (
            <label key={s.key} className="block rounded-lg border border-border bg-card p-4">
              <span className="font-mono text-xs font-medium uppercase tracking-wide text-primary">
                {s.label}
              </span>
              <span className="mt-0.5 block font-sans text-xs text-muted-foreground">
                {s.blurb}
              </span>
              <select
                value={choice[s.key]}
                onChange={(e) =>
                  setChoice((prev) => ({ ...prev, [s.key]: e.target.value }))
                }
                className="mt-3 w-full rounded-md border border-input bg-background px-2 py-2 font-sans text-sm"
              >
                {CANDIDATES[s.key].map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                    {c.name === DEFAULTS[s.key] ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </section>

        <div className="mb-8 flex items-center gap-3">
          <button
            onClick={() => setChoice(DEFAULTS)}
            disabled={isDefault}
            className="rounded-md border border-border bg-secondary px-3 py-1.5 font-mono text-xs text-secondary-foreground disabled:opacity-40"
          >
            Reset to current
          </button>
          <span className="font-sans text-xs text-muted-foreground">
            {isDefault ? "Showing the fonts currently shipping." : "Previewing new fonts."}
          </span>
        </div>

        {/* Preview */}
        <section className="space-y-6">
          {/* Hero / display */}
          <div className="rounded-xl border border-border bg-card p-8">
            <SlotTag>font-display</SlotTag>
            <h2 className="font-display text-5xl font-bold leading-tight text-ink">
              Catch every kanji.
            </h2>
            <p className="mt-2 font-display text-3xl font-medium text-deep-red">
              あなたのノートから、日本語を。
            </p>
          </div>

          {/* Body */}
          <div className="rounded-xl border border-border bg-card p-8">
            <SlotTag>font-sans</SlotTag>
            <p className="max-w-2xl font-sans text-lg leading-relaxed text-foreground">
              KanjiKatch turns your handwritten notes into review-ready vocabulary.
              Snap a photo, and we extract the words, readings, and meanings for you.
            </p>
            <p className="mt-3 max-w-2xl font-sans leading-relaxed text-muted-foreground">
              手書きのノートを撮影するだけで、単語・読み方・意味を自動で抽出します。
              毎日の復習で、着実に語彙を増やしましょう。
            </p>
          </div>

          {/* Serif accent */}
          <div className="rounded-xl border border-border bg-card p-8">
            <SlotTag>font-serif</SlotTag>
            <p className="font-serif text-2xl leading-relaxed text-ink">
              「継続は力なり」— 千里の道も一歩から。
            </p>
            <p className="mt-2 font-serif text-lg italic text-muted-foreground">
              Persistence is power. Every journey begins with a single step.
            </p>
          </div>

          {/* Mono: kanji cards + numbers */}
          <div className="rounded-xl border border-border bg-card p-8">
            <SlotTag>font-mono</SlotTag>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { k: "勉強", r: "べんきょう", m: "study" },
                { k: "旅行", r: "りょこう", m: "travel" },
                { k: "新幹線", r: "しんかんせん", m: "bullet train" },
                { k: "図書館", r: "としょかん", m: "library" },
              ].map((card) => (
                <div
                  key={card.k}
                  className="rounded-lg border border-border bg-background p-4 text-center"
                >
                  <div className="font-mono text-3xl font-bold text-ink">{card.k}</div>
                  <div className="mt-1 font-mono text-sm text-primary">{card.r}</div>
                  <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {card.m}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-4 font-mono text-sm text-muted-foreground">
              <span>Streak: <span className="text-gold">27</span> days</span>
              <span>Due today: <span className="text-foreground">18</span></span>
              <span>Mastered: <span className="text-sage">342</span> / 500</span>
              <span className="rounded bg-secondary px-2 py-0.5 text-xs uppercase tracking-wide">
                N3 · JLPT
              </span>
            </div>
          </div>
        </section>

        {/* Apply snippet */}
        <section className="mt-10 rounded-xl border border-border bg-ink/5 p-6">
          <h3 className="font-display text-xl font-semibold text-ink">
            Apply this combination
          </h3>
          <p className="mt-1 font-sans text-sm text-muted-foreground">
            Paste into <code className="font-mono">src/app/globals.css</code>. The
            Tailwind slots already read these variables.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-ink p-4 font-mono text-xs leading-relaxed text-paper">
            {snippet}
          </pre>
        </section>
      </div>
    </div>
  );
}

function SlotTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-3 inline-block rounded bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
      {children}
    </span>
  );
}
