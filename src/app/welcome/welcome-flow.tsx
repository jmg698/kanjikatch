"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import { track } from "@/lib/track";
import {
  startWelcome,
  chooseSampleSource,
  skipOnboarding,
  completeOnboarding,
} from "./actions";

type Step = "pitch" | "source" | "summary";

export function WelcomeFlow({ initialStep }: { initialStep: Step }) {
  const [step, setStep] = useState<Step>(initialStep);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step === "pitch") track("onboarding_started");
  }, [step]);

  function handleStart() {
    setError(null);
    startTransition(async () => {
      try {
        await startWelcome();
        setStep("source");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function handleSkip() {
    setError(null);
    track("onboarding_skipped", { atStep: step });
    startTransition(async () => {
      try {
        await skipOnboarding();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function handleChooseSample(slug: string) {
    setError(null);
    track("onboarding_source_chosen", { source: "sample", sampleSlug: slug });
    track("onboarding_extraction_started", { isSample: true });
    startTransition(async () => {
      try {
        await chooseSampleSource(slug);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load sample.");
      }
    });
  }

  function handleFinish() {
    setError(null);
    track("onboarding_completed", { viaWildRevealCta: false });
    startTransition(async () => {
      try {
        await completeOnboarding();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto">
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === "pitch" && (
        <PitchStep onStart={handleStart} onSkip={handleSkip} pending={pending} />
      )}
      {step === "source" && (
        <SourceStep
          onChooseSample={handleChooseSample}
          onSkip={handleSkip}
          pending={pending}
        />
      )}
      {step === "summary" && (
        <SummaryStep onFinish={handleFinish} pending={pending} />
      )}
    </div>
  );
}

function ProgressChip({ current }: { current: 1 | 2 | 3 }) {
  return (
    <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
      {`0${current}`} / 03 · {current === 1 ? "撮" : current === 2 ? "拾" : "読"}
    </p>
  );
}

function PitchStep({
  onStart,
  onSkip,
  pending,
}: {
  onStart: () => void;
  onSkip: () => void;
  pending: boolean;
}) {
  return (
    <section className="text-center pt-8 sm:pt-16">
      <ProgressChip current={1} />
      <h1 className="mt-6 font-display text-5xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
        Catch your first.
      </h1>
      <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
        Three minutes. One photo. A library that grows from what you actually
        read.
      </p>

      <div className="mt-12 flex justify-center">
        <button
          onClick={onStart}
          disabled={pending}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-foreground text-background font-semibold text-base shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Show me
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <button
        onClick={onSkip}
        disabled={pending}
        className="mt-10 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      >
        I&rsquo;ve used KanjiKatch before — skip this.
      </button>
    </section>
  );
}

function SourceStep({
  onChooseSample,
  onSkip,
  pending,
}: {
  onChooseSample: (slug: string) => void;
  onSkip: () => void;
  pending: boolean;
}) {
  return (
    <section className="pt-4 sm:pt-8">
      <ProgressChip current={2} />
      <h1 className="mt-6 font-display text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
        Snap one page.
      </h1>
      <p className="mt-5 text-lg text-muted-foreground max-w-xl leading-relaxed">
        Your handwriting works. So does printed text, a screenshot, a manga
        panel.
      </p>

      {/* Phase 1: own-photo path is queued; sample-only walking skeleton. */}
      <div className="mt-10 rounded-2xl border border-dashed border-border bg-white/40 p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Use what&rsquo;s in front of you.</p>
        <p className="mt-2 leading-relaxed">
          Take a photo, paste a screenshot, or pick from your library — coming
          shortly. For now, borrow one of ours below so you can feel the loop.
        </p>
      </div>

      <div className="mt-10">
        <div className="flex items-center gap-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
            Or borrow one of ours.
          </p>
          <div className="flex-1 border-t border-border/60" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Borrowed for the demo. Removable in one tap.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3">
          <SampleTile
            slug="town-news-cat"
            label="Town News — the Nakano cat"
            difficultyTag="Beginner · easy news"
            disabled={pending}
            onSelect={onChooseSample}
          />
        </div>
      </div>

      <button
        onClick={onSkip}
        disabled={pending}
        className="mt-10 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      >
        Skip for now
      </button>
    </section>
  );
}

function SampleTile({
  slug,
  label,
  difficultyTag,
  disabled,
  onSelect,
}: {
  slug: string;
  label: string;
  difficultyTag: string;
  disabled: boolean;
  onSelect: (slug: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(slug)}
      disabled={disabled}
      className="group rounded-xl bg-white border p-5 flex items-center gap-4 text-left transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-wait"
      style={{ borderColor: "hsl(35 15% 86%)" }}
    >
      <div
        className="flex-shrink-0 w-14 h-14 rounded-lg flex items-center justify-center"
        style={{ background: "hsl(35 30% 94%)", border: "1px solid hsl(35 15% 86%)" }}
      >
        <BookOpen className="h-6 w-6 text-foreground/70" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-display font-semibold text-base text-foreground">
            {label}
          </p>
          <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground bg-[hsl(35_22%_92%)] px-1.5 py-0.5 rounded">
            guided sample
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{difficultyTag}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
    </button>
  );
}

function SummaryStep({
  onFinish,
  pending,
}: {
  onFinish: () => void;
  pending: boolean;
}) {
  return (
    <section className="text-center pt-8 sm:pt-16">
      <ProgressChip current={3} />
      <h1 className="mt-6 font-display text-5xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
        That&rsquo;s the loop.
      </h1>

      <ul className="mt-12 max-w-md mx-auto space-y-4 text-left">
        <li className="flex items-start gap-3">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-foreground/60 flex-shrink-0" />
          <span className="text-foreground/85">Tomorrow, a few more reviews.</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-foreground/60 flex-shrink-0" />
          <span className="text-foreground/85">Capture another page anytime.</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-foreground/60 flex-shrink-0" />
          <span className="text-foreground/85">
            We&rsquo;ll quietly nudge you in a few days. Change reminders in settings.
          </span>
        </li>
      </ul>

      <div className="mt-12 flex justify-center">
        <button
          onClick={onFinish}
          disabled={pending}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-foreground text-background font-semibold text-base shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Go to dashboard
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
