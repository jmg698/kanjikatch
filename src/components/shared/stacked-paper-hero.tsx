// Brand visual: three overlapping cards illustrating the
// capture → review → wild loop. Re-used on the landing page hero and
// the onboarding pitch screen so the first thing a signed-in user sees
// rhymes with the marketing page they just came from. Pure presentational
// — no props, no client behavior. Server-renderable.

export function StackedPaperHero() {
  return (
    <div className="relative h-[460px] sm:h-[520px] lg:h-[560px]">
      {/* Background seal */}
      <div
        aria-hidden
        className="absolute -top-2 -right-2 w-28 h-28 rounded flex items-center justify-center font-serif text-3xl select-none rotate-6 opacity-90"
        style={{
          background: "hsl(0 60% 38%)",
          color: "hsl(35 28% 97%)",
          boxShadow: "0 8px 20px -8px rgba(120, 30, 30, 0.4)",
        }}
      >
        漢字
        <br />
      </div>

      {/* Card 1 — captured note (back) */}
      <div
        className="absolute top-2 left-2 sm:left-6 w-[78%] sm:w-[72%] rotate-[-3deg]"
        style={{ transformOrigin: "center" }}
      >
        <div
          className="rounded-xl p-5 border"
          style={{
            background:
              "repeating-linear-gradient(0deg, hsl(35 30% 96%) 0px, hsl(35 30% 96%) 27px, hsl(35 18% 90%) 28px)",
            borderColor: "hsl(35 18% 84%)",
            boxShadow: "0 18px 30px -18px rgba(60, 50, 40, 0.35)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
              Page 14 — Genki II
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.18em] text-[hsl(0_60%_38%)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(0_60%_38%)]" />
              Caught
            </span>
          </div>
          <div className="font-serif text-foreground/90 leading-[1.9] text-lg">
            <span className="text-2xl">毎朝</span>、コーヒーを<span className="text-2xl">飲</span>みながら、
            <br />
            日本<span className="text-2xl">語</span>の<span className="text-2xl">新聞</span>を読みます。
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["毎", "朝", "飲", "語", "新", "聞", "読"].map((c) => (
              <span
                key={c}
                className="font-serif text-base px-2 py-0.5 rounded border bg-white"
                style={{ borderColor: "hsl(35 15% 84%)" }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Card 2 — kanji entry (middle) */}
      <div className="absolute top-[44%] left-0 sm:left-2 w-[60%] sm:w-[54%] rotate-[2deg]">
        <div
          className="rounded-xl bg-white border p-5"
          style={{
            borderColor: "hsl(35 18% 84%)",
            boxShadow: "0 22px 36px -18px rgba(60, 50, 40, 0.32)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="font-serif text-[5rem] leading-[0.9] text-foreground">
              読
            </span>
            <span
              className="text-[10px] font-mono uppercase tracking-[0.22em] px-2 py-1 rounded"
              style={{
                background: "hsl(150 35% 92%)",
                color: "hsl(150 50% 26%)",
              }}
            >
              Guru
            </span>
          </div>
          <div className="mt-3 space-y-1">
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground">
              よ・む / ドク
            </p>
            <p className="text-sm text-foreground/80">read · study · count</p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Reviewed 4×</span>
            <span className="font-mono">Next: tomorrow</span>
          </div>
        </div>
      </div>

      {/* Card 3 — wild sentence (front) */}
      <div className="absolute bottom-0 right-0 w-[80%] sm:w-[68%] rotate-[-1.5deg]">
        <div
          className="rounded-xl bg-white border p-5"
          style={{
            borderColor: "hsl(35 18% 84%)",
            boxShadow: "0 26px 44px -16px rgba(60, 50, 40, 0.38)",
          }}
        >
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-[hsl(150_50%_26%)] mb-3">
            In the wild
          </p>
          <p className="wild-sentence-text text-lg sm:text-xl">
            あのカフェで
            <span className="wild-studied-word">
              <ruby>
                新聞<rt>しんぶん</rt>
              </ruby>
            </span>
            を
            <span className="wild-studied-word">
              <ruby>
                読<rt>よ</rt>
              </ruby>
            </span>
            むのが<span className="wild-partial-word">日課</span>です。
          </p>
          <p className="mt-3 text-sm text-muted-foreground italic">
            Reading the paper at that café is part of my routine.
          </p>
        </div>
      </div>
    </div>
  );
}
