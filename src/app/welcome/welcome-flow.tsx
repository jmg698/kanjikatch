"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StackedPaperHero } from "@/components/shared/stacked-paper-hero";
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

  function handleCatchAnother() {
    setError(null);
    track("onboarding_completed", { viaWildRevealCta: false });
    // Mark complete then route straight to /capture so the user keeps the
    // momentum. Completing the tour first is required so the dashboard
    // gate doesn't bounce them back to /welcome from inside the (dashboard)
    // layout that /capture lives under.
    startTransition(async () => {
      try {
        await completeOnboarding("/capture");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  // Pitch screen wants the wider grid layout for the hero visual; other
  // steps stay in a narrower column for readability.
  const containerClass =
    step === "pitch" ? "max-w-5xl mx-auto" : "max-w-2xl mx-auto";

  return (
    <div className={containerClass}>
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
        <SummaryStep
          onFinish={handleFinish}
          onCatchAnother={handleCatchAnother}
          pending={pending}
        />
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
    <section className="pt-4 sm:pt-10">
      <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14 items-center">
        <div>
          <ProgressChip current={1} />
          <h1 className="mt-5 font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
            Catch your first.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-xl leading-relaxed">
            Three minutes. One photo. A library that grows from what you
            actually read.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="h-12 px-7 text-base shadow-sm"
              onClick={onStart}
              disabled={pending}
            >
              Show me
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <button
              type="button"
              onClick={onSkip}
              disabled={pending}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 px-3 py-2"
            >
              I&rsquo;ve used KanjiKatch before — skip this.
            </button>
          </div>
        </div>

        <div className="hidden lg:block">
          <StackedPaperHero />
        </div>
      </div>
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
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
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

      {/* Own-photo path lands in Phase 2.1. Tiles render as "available soon"
          so the screen doesn't read as half-built. */}
      <div className="mt-10 grid grid-cols-3 gap-3">
        {(
          [
            { label: "Take a photo" },
            { label: "Paste a screenshot" },
            { label: "Pick from library" },
          ] as const
        ).map((tile) => (
          <div
            key={tile.label}
            className="rounded-xl border border-dashed bg-white/40 px-3 py-4 text-center"
            style={{ borderColor: "hsl(35 15% 80%)" }}
          >
            <p className="text-sm font-medium text-foreground/80">{tile.label}</p>
            <p className="mt-1.5 text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              available soon
            </p>
          </div>
        ))}
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
            imagePath="/samples/town-news-cat.png"
            disabled={pending}
            expanded={expandedSlug === "town-news-cat"}
            onExpand={() => setExpandedSlug("town-news-cat")}
            onBorrow={onChooseSample}
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
  imagePath,
  disabled,
  expanded,
  onExpand,
  onBorrow,
}: {
  slug: string;
  label: string;
  difficultyTag: string;
  imagePath: string;
  disabled: boolean;
  expanded: boolean;
  onExpand: () => void;
  onBorrow: (slug: string) => void;
}) {
  return (
    <div
      className="rounded-xl bg-white border overflow-hidden"
      style={{ borderColor: "hsl(35 15% 86%)" }}
    >
      <button
        type="button"
        onClick={expanded ? undefined : onExpand}
        disabled={disabled}
        className="w-full px-5 py-4 flex items-center gap-4 text-left transition-colors hover:bg-[hsl(35_30%_98%)] disabled:opacity-50 disabled:cursor-wait"
        aria-expanded={expanded}
      >
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
        {!expanded && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5">
          <div
            className="relative w-full rounded-lg overflow-hidden border"
            style={{ aspectRatio: "16 / 9", borderColor: "hsl(35 15% 90%)" }}
          >
            <Image
              src={imagePath}
              alt={label}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 672px"
              priority
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
            This is what we&rsquo;ll catch from. You can review and edit every
            card before they land in your library.
          </p>
          <Button
            size="lg"
            className="mt-4 w-full h-12 text-sm"
            onClick={() => onBorrow(slug)}
            disabled={disabled}
          >
            Borrow this one
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}

function SummaryStep({
  onFinish,
  onCatchAnother,
  pending,
}: {
  onFinish: () => void;
  onCatchAnother: () => void;
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

      <div className="mt-12 flex flex-col items-center gap-3">
        <Button
          size="lg"
          className="h-12 px-8 text-base shadow-sm"
          onClick={onFinish}
          disabled={pending}
        >
          Go to dashboard
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
        <button
          type="button"
          onClick={onCatchAnother}
          disabled={pending}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 px-3 py-2"
        >
          Or catch another page →
        </button>
      </div>
    </section>
  );
}
