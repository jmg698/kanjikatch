/**
 * Per-kanji and per-source progress, derived from existing SRS state.
 *
 * Sentence reviews intentionally do NOT feed this — the rating users give
 * sentences is a calibration signal for the generator, not a comprehension
 * signal. Tying mastery to it would corrupt both jobs. Flashcard SRS is the
 * only input here.
 *
 * The framing is deliberately encouraging rather than achievement-y: tiers
 * describe how the relationship is going, not how impressive the user is.
 */

import type { ConfidenceLevel } from "./srs";
import { computeEffectiveConfidence } from "./track-queries";

export type SourceTier = "just_started" | "getting_familiar" | "settling_in" | "reading_freely";

const CONFIDENCE_ORDER: ConfidenceLevel[] = ["new", "learning", "reviewing", "known"];

export interface KanjiProgress {
  confidence: ConfidenceLevel;
  // Position 0..1 along the four confidence steps. Used for thin progress
  // bars where a single kanji's growth is shown — not a precise score.
  step: number;
}

export function getKanjiProgress(
  tracks: { confidenceLevel: string }[],
): KanjiProgress {
  const confidence = computeEffectiveConfidence(tracks) as ConfidenceLevel;
  const idx = CONFIDENCE_ORDER.indexOf(confidence);
  return {
    confidence,
    step: idx >= 0 ? idx / (CONFIDENCE_ORDER.length - 1) : 0,
  };
}

export interface SourceProgressBreakdown {
  total: number;
  new: number;
  learning: number;
  reviewing: number;
  known: number;
}

export interface SourceProgress {
  breakdown: SourceProgressBreakdown;
  // 0..1 — fraction of kanji from the source the user can read confidently.
  // Defined as known / total. Honest, verifiable, not a weighted score.
  readableFraction: number;
  tier: SourceTier;
  // Encouraging label for the tier — phrased as growth, not achievement.
  tierLabel: string;
  // Short supportive nudge that pairs with the tier.
  encouragement: string;
}

/**
 * Compute progress for a single source from its kanji's effective confidences.
 * The caller is responsible for resolving each kanji's tracks down to one
 * confidence (e.g. via computeEffectiveConfidence).
 */
export function getSourceProgress(
  itemConfidences: ConfidenceLevel[],
): SourceProgress {
  const breakdown: SourceProgressBreakdown = {
    total: itemConfidences.length,
    new: 0,
    learning: 0,
    reviewing: 0,
    known: 0,
  };

  for (const c of itemConfidences) {
    breakdown[c]++;
  }

  const readableFraction = breakdown.total > 0 ? breakdown.known / breakdown.total : 0;
  const tier = pickTier(breakdown);

  return {
    breakdown,
    readableFraction,
    tier,
    tierLabel: TIER_COPY[tier].label,
    encouragement: TIER_COPY[tier].encouragement,
  };
}

const TIER_COPY: Record<SourceTier, { label: string; encouragement: string }> = {
  just_started: {
    label: "Just started",
    encouragement: "Every review is a step. Keep going.",
  },
  getting_familiar: {
    label: "Getting familiar",
    encouragement: "These are starting to feel like old friends.",
  },
  settling_in: {
    label: "Settling in",
    encouragement: "Most of these are clicking — you're doing great.",
  },
  reading_freely: {
    label: "Reading freely",
    encouragement: "You can move through this comfortably now.",
  },
};

function pickTier(b: SourceProgressBreakdown): SourceTier {
  if (b.total === 0) return "just_started";
  const known = b.known / b.total;
  const knownOrReviewing = (b.known + b.reviewing) / b.total;

  if (known >= 0.8) return "reading_freely";
  if (known >= 0.4) return "settling_in";
  if (knownOrReviewing >= 0.3) return "getting_familiar";
  return "just_started";
}

export function getDefaultSourceName(uploadedAt: Date): string {
  const month = uploadedAt.toLocaleString("en-US", { month: "short" });
  const day = uploadedAt.getDate();
  return `Capture · ${month} ${day}`;
}
