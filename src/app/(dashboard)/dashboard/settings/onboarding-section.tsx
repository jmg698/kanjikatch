"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import {
  replayOnboarding,
  removeOnboardingSamples,
} from "./onboarding-actions";

interface Props {
  sampleSourceCount: number;
}

export function OnboardingSection({ sampleSourceCount }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [removed, setRemoved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasSamples = sampleSourceCount > 0 && removed === null;

  function handleReplay() {
    setError(null);
    startTransition(async () => {
      try {
        await replayOnboarding();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function handleRemoveSamples() {
    setError(null);
    startTransition(async () => {
      try {
        const { removed: count } = await removeOnboardingSamples();
        setRemoved(count);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Replay onboarding tour</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Walk through the welcome flow again — pitch, sample, review, wild
            sentence. Your existing library is untouched.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReplay}
          disabled={pending}
        >
          Replay
          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </div>

      {hasSamples && (
        <div className="flex items-start justify-between gap-4 flex-wrap pt-3 border-t" style={{ borderColor: "hsl(35 15% 92%)" }}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Remove guided sample cards
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You have {sampleSourceCount} guided sample {sampleSourceCount === 1 ? "source" : "sources"} in your library.
              Removing the {sampleSourceCount === 1 ? "source" : "sources"} clears {confirming ? "this borrowed material" : "the borrowed material"} from your library.
            </p>
          </div>
          {confirming ? (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handleRemoveSamples} disabled={pending}>
                Remove
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setConfirming(true)} disabled={pending}>
              Remove
            </Button>
          )}
        </div>
      )}

      {removed !== null && (
        <p className="text-xs text-muted-foreground italic">
          {removed === 0
            ? "No sample sources to remove."
            : `Removed ${removed} sample ${removed === 1 ? "source" : "sources"}.`}
        </p>
      )}
    </div>
  );
}
