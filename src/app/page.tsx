import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import {
  Camera,
  ArrowRight,
  ScanLine,
  Layers,
  Sparkles,
  BookOpenText,
  GraduationCap,
  Newspaper,
  Headphones,
  Check,
  Minus,
  RotateCcw,
} from "lucide-react";

export default async function HomePage() {
  const { userId } = await auth();
  const ctaHref = userId ? "/dashboard" : "/sign-up";
  const ctaLabel = userId ? "Open dashboard" : "Catch your first page";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header userId={userId} />
      <Hero ctaHref={ctaHref} ctaLabel={ctaLabel} />
      <HowItWorks />
      <WildSpotlight />
      <BuiltFor />
      <WhyKanjiKatch />
      <FAQ />
      <FinalCTA ctaHref={ctaHref} ctaLabel={ctaLabel} />
      <Footer />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Header                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function Header({ userId }: { userId: string | null }) {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border/60">
      <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-baseline gap-2.5 group">
          <span className="font-serif text-2xl text-primary leading-none">漢字</span>
          <span className="font-display text-xl font-semibold tracking-tight">
            KanjiKatch
          </span>
          <span className="hidden sm:inline text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70 ml-1">
            キャッチ
          </span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-3">
          <Link
            href="#how"
            className="hidden md:inline text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
          >
            How it works
          </Link>
          <Link
            href="#wild"
            className="hidden md:inline text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
          >
            In the wild
          </Link>
          <Link
            href="/pricing"
            className="hidden md:inline text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
          >
            Pricing
          </Link>
          <Link
            href="#faq"
            className="hidden md:inline text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
          >
            FAQ
          </Link>
          {userId ? (
            <Button asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/sign-up">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Hero                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

function Hero({ ctaHref, ctaLabel }: { ctaHref: string; ctaLabel: string }) {
  return (
    <section className="relative overflow-hidden">
      {/* Soft washi paper wash */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 10%, hsl(35 40% 94%) 0%, transparent 60%), radial-gradient(50% 40% at 90% 20%, hsl(150 30% 94%) 0%, transparent 60%)",
        }}
      />
      <div className="container mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-14 items-center">
          {/* Left: copy */}
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-[hsl(38_70%_38%)]">
              <span className="inline-block w-6 h-px bg-[hsl(38_70%_38%)]/60" />
              A personal Japanese SRS
            </p>
            <h1 className="mt-5 font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight">
              Catch the Japanese
              <br />
              you actually
              <span className="relative inline-block ml-3">
                <span className="relative z-10 text-primary">read.</span>
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-1 h-3 -z-0"
                  style={{ background: "hsl(45 100% 72% / 0.55)" }}
                />
              </span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground max-w-xl">
              Anything with Japanese on it — handwritten notes, a textbook page,
              a news screenshot, a manga panel. KanjiKatch reads the page,
              catches every kanji, word, and sentence, and builds a review deck
              calibrated to what you already know. Your studied words reappear
              in fresh sentences; the new ones you spot there become tomorrow's
              catch.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" className="h-12 px-7 text-base shadow-sm" asChild>
                <Link href={ctaHref}>
                  {ctaLabel}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="h-12 px-5 text-base"
                asChild
              >
                <Link href="#how">See how it works</Link>
              </Button>
            </div>
            <p className="mt-5 text-xs text-muted-foreground/80">
              Free to start · Works with handwriting, print, and screenshots ·
              No deck imports required
            </p>
          </div>

          {/* Right: stacked paper demo */}
          <HeroDemo />
        </div>
      </div>
    </section>
  );
}

function HeroDemo() {
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
            <p className="text-sm text-foreground/80">
              read · study · count
            </p>
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
            あのカフェで<span className="wild-studied-word">
              <ruby>
                新聞<rt>しんぶん</rt>
              </ruby>
            </span>
            を<span className="wild-studied-word">
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

/* ────────────────────────────────────────────────────────────────────────── */
/*  How it works                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

function HowItWorks() {
  const steps = [
    {
      kanji: "撮",
      reading: "とる",
      en: "Snap",
      title: "Snap anything.",
      body: "Handwritten notes, a textbook spread, a news screenshot, a manga panel, the lyric sheet on your fridge — if it has Japanese on it, KanjiKatch can parse it. Rough handwriting included.",
      icon: Camera,
    },
    {
      kanji: "拾",
      reading: "ひろう",
      en: "Catch",
      title: "We pull every word.",
      body: "Every kanji, vocabulary item, and full sentence on the page is pulled out for you, with readings, meanings, and example sentences filled in. Edit anything that's not quite right in one tap.",
      icon: ScanLine,
    },
    {
      kanji: "覚",
      reading: "おぼえる",
      en: "Master",
      title: "Review until it sticks.",
      body: "A spaced repetition schedule keeps the words you almost know in front of you and quietly retires the ones you've nailed. Daily review takes minutes — not a planning session.",
      icon: Layers,
    },
    {
      kanji: "読",
      reading: "よむ",
      en: "Read",
      title: "See it back in the wild.",
      body: "Fresh sentences calibrated to your exact deck. Studied words glow gold; partials get a teal underline. Tap an unfamiliar word and it becomes tomorrow's catch. The cycle compounds.",
      icon: Sparkles,
    },
  ];

  return (
    <section id="how" className="border-t border-border/60">
      <div className="container mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="max-w-2xl">
          <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
            ・The cycle ・
          </p>
          <h2 className="mt-4 font-display text-4xl sm:text-5xl font-bold tracking-tight">
            A study cycle that grows with you.
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            No importing CSVs. No copying readings off Jisho. Snap a textbook
            page, a sticky note, a news article on your phone — anything with
            Japanese on it. KanjiKatch turns it into a deck that knows what you
            already know, then keeps feeding you new material from inside it.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div
              key={s.en}
              className="relative bg-white rounded-2xl border p-7"
              style={{
                borderColor: "hsl(35 15% 86%)",
                boxShadow:
                  "0 4px 6px -1px rgba(0,0,0,0.04), 0 2px 4px -1px rgba(0,0,0,0.02)",
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="font-serif text-5xl text-primary leading-none">
                    {s.kanji}
                  </span>
                  <span className="mt-1.5 text-[10px] font-mono text-muted-foreground tracking-[0.18em]">
                    {s.reading}
                  </span>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
                  0{i + 1} · {s.en}
                </span>
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
              <s.icon className="mt-6 h-5 w-5 text-muted-foreground/60" />
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-center gap-3 text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" />
          <span>
            Step 04 feeds back into step 01. The deck deepens every loop.
          </span>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  See it in the wild — signature feature spotlight                          */
/* ────────────────────────────────────────────────────────────────────────── */

function WildSpotlight() {
  return (
    <section
      id="wild"
      className="border-t border-border/60"
      style={{
        background:
          "linear-gradient(180deg, hsl(35 28% 97%) 0%, hsl(35 35% 95%) 100%)",
      }}
    >
      <div className="container mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-[hsl(150_50%_26%)]">
              <Sparkles className="h-3.5 w-3.5" />
              In the wild
            </p>
            <h2 className="mt-4 font-display text-4xl sm:text-5xl font-bold tracking-tight">
              Sentences calibrated
              <br />
              to your exact deck.
            </h2>
            <p className="mt-5 text-lg text-muted-foreground">
              After every review, KanjiKatch generates fresh sentences seeded
              with words you've actually studied — and stretched with one or
              two new pieces sized to where you are. Studied words glow gold.
              Partials — new words built from kanji you already know — get a
              teal underline. Tap anything new and it joins your deck.
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                "Every sentence is built from your deck — and grows with it. Beginner today, novel-ready in a year.",
                "Tap an unfamiliar word and it lands in your review queue. Your reading writes your study list.",
                "The studied-to-new ratio shifts as you grow. The reading always meets you exactly where you are.",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-foreground/85">{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="rounded-2xl bg-white border p-8 sm:p-10"
            style={{
              borderColor: "hsl(35 18% 84%)",
              boxShadow:
                "0 30px 60px -30px rgba(60, 50, 40, 0.35), 0 8px 16px -8px rgba(60, 50, 40, 0.1)",
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
                Sentence 3 of 5
              </span>
              <span className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(45_100%_55%)]" />
                Studied
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(176_55%_42%)] ml-2" />
                Partial
              </span>
            </div>

            <p className="wild-sentence-text text-2xl sm:text-3xl">
              <span className="wild-studied-word">
                <ruby>
                  毎朝<rt>まいあさ</rt>
                </ruby>
              </span>
              、<span className="wild-studied-word">
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
              みながら、
              <span className="wild-partial-word">
                <ruby>
                  紅茶<rt>こうちゃ</rt>
                </ruby>
              </span>
              を
              <span className="wild-studied-word">
                <ruby>
                  飲<rt>の</rt>
                </ruby>
              </span>
              みます。
            </p>

            <div className="mt-6 pt-6 border-t border-dashed border-border">
              <p className="text-sm text-muted-foreground italic">
                Every morning I drink black tea while reading the paper.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    className={`w-7 h-1 rounded-full ${
                      n <= 3 ? "bg-primary" : "bg-border"
                    }`}
                  />
                ))}
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                tap to reveal · ⌘ ↵
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Built for…                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function BuiltFor() {
  const types = [
    {
      icon: BookOpenText,
      title: "Textbook learners",
      body: "Genki, Tobira, Quartet — turn each chapter into the only deck you need for it.",
    },
    {
      icon: GraduationCap,
      title: "Classroom students",
      body: "Snap the whiteboard, your handout, or last night's homework. Be ready for Friday's quiz.",
    },
    {
      icon: Newspaper,
      title: "Manga & novel readers",
      body: "Catch the words on the page in front of you, not the JLPT list someone else made.",
    },
    {
      icon: Headphones,
      title: "Immersion learners",
      body: "Screenshot subtitles, signage, lyrics, anything. If kanji is on it, KanjiKatch can read it.",
    },
  ];

  return (
    <section className="border-t border-border/60">
      <div className="container mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="max-w-xl">
            <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
              ・Built for ・
            </p>
            <h2 className="mt-4 font-display text-4xl sm:text-5xl font-bold tracking-tight">
              However you meet Japanese.
            </h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">
            KanjiKatch doesn't pick the words for you. Your materials do —
            anything with Japanese on it, and that's the whole point.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {types.map((t) => (
            <div
              key={t.title}
              className="rounded-xl bg-white border p-6 hover:-translate-y-0.5 transition-transform"
              style={{ borderColor: "hsl(35 15% 88%)" }}
            >
              <t.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-4 font-display text-lg font-semibold">
                {t.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Why KanjiKatch — quiet differentiation                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function WhyKanjiKatch() {
  const rows: { label: string; anki: string | null; wk: string | null; kk: string }[] = [
    {
      label: "Deck shaped by your materials",
      anki: null,
      wk: null,
      kk: "Built from photos of what you read",
    },
    {
      label: "Readings & meanings filled in",
      anki: null,
      wk: "Fixed list",
      kk: "Auto, editable",
    },
    {
      label: "Real sentences with your words",
      anki: null,
      wk: "Fixed examples",
      kk: "Generated each session",
    },
    {
      label: "Spaced repetition",
      anki: "Yes",
      wk: "Yes",
      kk: "Yes",
    },
    {
      label: "Setup time",
      anki: "Hours",
      wk: "Pre-set",
      kk: "One photo",
    },
  ];

  return (
    <section
      className="border-t border-border/60"
      style={{ background: "hsl(35 22% 96%)" }}
    >
      <div className="container mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="max-w-2xl">
          <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
            ・Why KanjiKatch ・
          </p>
          <h2 className="mt-4 font-display text-4xl sm:text-5xl font-bold tracking-tight">
            Anki is a blank deck. WaniKani is a fixed curriculum.
            <span className="text-primary"> KanjiKatch is yours.</span>
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            We're not trying to replace the great tools you already use. We're
            the missing one — the deck shaped exactly by what's in front of
            you today.
          </p>
        </div>

        <div
          className="mt-12 overflow-hidden rounded-2xl border bg-white"
          style={{ borderColor: "hsl(35 18% 86%)" }}
        >
          <div className="grid grid-cols-4 gap-0 text-sm">
            <div
              className="p-4 sm:p-5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground border-b"
              style={{ borderColor: "hsl(35 15% 90%)" }}
            />
            <div
              className="p-4 sm:p-5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground border-b text-center"
              style={{ borderColor: "hsl(35 15% 90%)" }}
            >
              Anki
            </div>
            <div
              className="p-4 sm:p-5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground border-b text-center"
              style={{ borderColor: "hsl(35 15% 90%)" }}
            >
              WaniKani
            </div>
            <div
              className="p-4 sm:p-5 font-mono text-[10px] uppercase tracking-[0.22em] text-primary border-b text-center font-bold"
              style={{ borderColor: "hsl(35 15% 90%)" }}
            >
              KanjiKatch
            </div>
            {rows.map((r, idx) => {
              const last = idx === rows.length - 1;
              const borderClass = last ? "" : "border-b";
              const borderStyle = last
                ? undefined
                : { borderColor: "hsl(35 15% 92%)" };
              const cell = (val: string | null) =>
                val ? (
                  <span className="text-foreground/80">{val}</span>
                ) : (
                  <Minus className="h-4 w-4 text-muted-foreground/50 mx-auto" />
                );
              return (
                <div key={r.label} className="contents">
                  <div
                    className={`p-4 sm:p-5 ${borderClass} font-medium`}
                    style={borderStyle}
                  >
                    {r.label}
                  </div>
                  <div
                    className={`p-4 sm:p-5 ${borderClass} text-center text-sm`}
                    style={borderStyle}
                  >
                    {cell(r.anki)}
                  </div>
                  <div
                    className={`p-4 sm:p-5 ${borderClass} text-center text-sm`}
                    style={borderStyle}
                  >
                    {cell(r.wk)}
                  </div>
                  <div
                    className={`p-4 sm:p-5 ${borderClass} text-center text-sm bg-[hsl(150_30%_97%)]`}
                    style={borderStyle}
                  >
                    <span className="text-[hsl(150_50%_26%)] font-medium">
                      {r.kk}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  FAQ                                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function FAQ() {
  const items = [
    {
      q: "What can I photograph?",
      a: "Anything with Japanese on it. Handwritten notes, textbook pages, news screenshots, manga panels, signage you spotted on the street, sticky notes from class, subtitles from a paused show. KanjiKatch was built on rough handwriting — anything unclear, you can correct in one tap.",
    },
    {
      q: "How are the sentences in 'Read' generated?",
      a: "Every sentence is built from words in your deck, calibrated to your exact level. Beginners get short sentences with one or two unfamiliar pieces; advanced learners get longer, denser ones. As your deck grows, so does the reading.",
    },
    {
      q: "What level should I be?",
      a: "Anywhere from your first kanji to N1. KanjiKatch doesn't pick a curriculum for you — your materials do. Beginners get the most out of textbook pages; advanced learners feed in novels, news articles, and screenshots from anything they're already reading.",
    },
    {
      q: "Do I have to type readings and meanings?",
      a: "Never. KanjiKatch fills in readings, meanings, and example sentences when it catches a new word. Edit anything that doesn't feel right.",
    },
    {
      q: "Does it replace Anki or WaniKani?",
      a: "It doesn't try to. WaniKani is a great curriculum if you want one chosen for you. Anki is a great empty deck. KanjiKatch is the one that matches the page you're reading right now — and keeps generating new reading from the words you've already learned.",
    },
    {
      q: "What does it cost?",
      a: "Free forever for the daily review habit — 10 starter extractions plus 5 per month, unlimited reviews. Pro ($10/mo or $100/yr, with a 7-day free trial) unlocks unlimited captures, audio on every sentence, 3–5 personalized sentences per session, and a session recap email. See the full breakdown on the pricing page.",
    },
  ];

  return (
    <section id="faq" className="border-t border-border/60">
      <div className="container mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
              ・FAQ ・
            </p>
            <h2 className="mt-4 font-display text-4xl font-bold tracking-tight">
              Questions
              <br />
              before you start.
            </h2>
          </div>
          <div className="divide-y" style={{ borderColor: "hsl(35 15% 90%)" }}>
            {items.map((item) => (
              <details key={item.q} className="group py-5 first:pt-0">
                <summary className="flex items-start justify-between gap-6 cursor-pointer list-none">
                  <span className="font-display text-lg font-semibold text-foreground">
                    {item.q}
                  </span>
                  <span className="font-mono text-xl text-muted-foreground transition-transform group-open:rotate-45 leading-none mt-0.5">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-muted-foreground leading-relaxed">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Final CTA                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function FinalCTA({
  ctaHref,
  ctaLabel,
}: {
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <section className="border-t border-border/60">
      <div className="container mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div
          className="relative rounded-3xl overflow-hidden p-10 sm:p-16 text-center"
          style={{
            background:
              "linear-gradient(135deg, hsl(152 50% 22%) 0%, hsl(152 60% 16%) 100%)",
            color: "hsl(35 28% 97%)",
          }}
        >
          <div
            aria-hidden
            className="absolute -top-12 -right-12 font-serif text-[18rem] leading-none opacity-[0.05] select-none"
          >
            漢字
          </div>
          <p className="relative text-[11px] font-mono uppercase tracking-[0.22em] opacity-70">
            ・Catch the next one ・
          </p>
          <h2 className="relative mt-4 font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl mx-auto leading-[1.1]">
            The next page of Japanese you read could be your next deck.
          </h2>
          <p className="relative mt-5 text-lg opacity-85 max-w-xl mx-auto">
            Sign up free, take one photo, and watch a personal review schedule
            build itself.
          </p>
          <div className="relative mt-8 flex justify-center">
            <Button
              size="lg"
              className="h-12 px-8 text-base bg-white text-[hsl(152_60%_18%)] hover:bg-white/90"
              asChild
            >
              <Link href={ctaHref}>
                {ctaLabel}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Footer                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="container mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-xl text-primary">漢字</span>
          <span className="font-display font-semibold">KanjiKatch</span>
          <span className="text-xs text-muted-foreground ml-2">
            built for Japanese learners
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} KanjiKatch
        </p>
      </div>
    </footer>
  );
}
