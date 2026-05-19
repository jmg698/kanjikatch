"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import {
  ExtractionConfirmation,
  type SaveResponse,
} from "@/app/(dashboard)/capture/extraction-confirmation";
import type { ExtractionResult } from "@/lib/validations";
import { track } from "@/lib/track";

interface Props {
  sourceId: string;
  label: string;
  imagePath: string;
  extraction: ExtractionResult;
}

export function ConfirmFlow({ sourceId, label, imagePath, extraction }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function handleSaved(data: SaveResponse) {
    track("onboarding_cards_saved", {
      cardsSaved:
        data.extracted.kanji.total +
        data.extracted.vocabulary.total +
        data.extracted.sentences,
    });
    router.push("/review?size=5&onboarding=1");
  }

  function handleDiscard() {
    // Returning to /welcome leaves the source row behind, but it's marked
    // isOnboardingSample and processed=false, so the user can pick again
    // and end up on a fresh /welcome/confirm with a new sourceId. We keep
    // it for tomorrow's Phase 2.2 "remove sample cards" sweep.
    router.push("/welcome");
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
          02 / 03 · 拾
        </p>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight leading-[1.1]">
          Review what we caught.
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Keep what matters. Fix anything in a tap.
        </p>
      </div>

      <div className="mb-5 rounded-xl border bg-white overflow-hidden" style={{ borderColor: "hsl(35 15% 86%)" }}>
        <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ borderColor: "hsl(35 15% 92%)" }}>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground bg-[hsl(35_22%_92%)] px-1.5 py-0.5 rounded">
            guided sample
          </span>
        </div>
        <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
          <Image
            src={imagePath}
            alt={label}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 672px"
            priority
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <ExtractionConfirmation
        sourceImageId={sourceId}
        extraction={extraction}
        onSaved={handleSaved}
        onDiscard={handleDiscard}
        onError={(message) => setError(message)}
      />
    </div>
  );
}
