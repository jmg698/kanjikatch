// Onboarding instrumentation shim. Today: no-op in prod, console-log in dev
// when NEXT_PUBLIC_TRACK_DEBUG=1. Tomorrow (Package 6): swap the body for
// PostHog (or equivalent) without touching any call sites.
//
// See ONBOARDING_PLAN.md §Instrumentation hooks for the full event contract.
// Don't add general app instrumentation here — keep this surface narrow to
// onboarding milestones only until the analytics provider lands.

export type OnboardingEvent =
  | "onboarding_started"
  | "onboarding_source_chosen"
  | "onboarding_extraction_started"
  | "onboarding_extraction_succeeded"
  | "onboarding_extraction_failed"
  | "onboarding_cards_saved"
  | "onboarding_first_card_reviewed"
  | "onboarding_review_completed"
  | "onboarding_review_exited_early"
  | "onboarding_wild_revealed"
  | "onboarding_word_caught_from_wild"
  | "onboarding_completed"
  | "onboarding_skipped"
  | "onboarding_time_guardrail_offered"
  | "onboarding_time_guardrail_taken";

const DEBUG_ENABLED =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_TRACK_DEBUG === "1";

export function track(event: OnboardingEvent, props?: Record<string, unknown>): void {
  if (!DEBUG_ENABLED) return;
  try {
    // eslint-disable-next-line no-console
    console.log(`[track] ${event}`, props ?? {});
  } catch {
    // Never let instrumentation affect UX.
  }
}
