# Onboarding Build Plan

**Status:** v1.1 build spec
**Supersedes (as build doc):** `ONBOARDING_INSPIRATION.md` — kept as reference for the why; this is the what and how.

## Thesis

The tutorial **is** the loop. By the time onboarding ends, the user has personally completed one full revolution — capture → catch → master → read — and the app already knows them a little. Every screen is a real screen doing real work, not a marketing tour layered over a static dashboard.

The activation metric from `PRO_TIER_PLAN.md` is unchanged and authoritative for funnel work: **1 extraction → 1 review → 1 personalized sentence within 48 hours.** Onboarding delivers all three inside the first session.

**Complementary success lens (for onboarding only):** *first personal knowledge loop completed.* A user clears the loop when, within the first session, they have (a) saved at least one item from a real or sample source, (b) reviewed at least one card, (c) seen a sentence containing studied material, and (d) caught at least one new word **from** that sentence — proving they understand the library grows from reading. This is the lens we use to evaluate onboarding quality; the PRO_TIER metric is the lens we use to evaluate the funnel.

## The experience bar

We are aiming at Airbnb-list-your-place / Stash-pin-the-share-sheet quality, translated to KanjiKatch's voice. That means:

- **Visual continuity between steps.** The captured image carries through to extraction, the extracted kanji carries through to the first card, the first card carries through to the wild sentence. Nothing teleports.
- **Earned micro-interactions.** Haptics fire on meaningful moments (first card flipped, wild sentence revealed) — never decoratively. Reuse the existing flashcard haptic vocabulary.
- **The wait is the demo.** The 15–25s extraction wait is the magic trick, not a progress bar. Kanji float up off the image one at a time with a live count.
- **One job per screen.** Pitch, source choice, capture, confirm, review, wild. Never two.
- **Calm confidence voice.** Big serif headlines, short editorial subheads, mono-uppercase labels. No exclamation points, no emoji, no SaaS energy. Microcopy bank in §7.

## The final flow

Five moments. Two are dedicated onboarding screens; the other three are coachmark layers riding on top of existing app screens.

| # | Where | Mode | Step |
|---|---|---|---|
| 1 | `/welcome` step 1 | New screen | **Pitch.** Set expectation: three minutes, one page, your own deck. |
| 2 | `/welcome` step 2 | New screen | **Choose your source.** Primary path: their own material with easy how-to. Backup: 3 samples at varied difficulty. |
| 3 | `/capture` + `/capture/extraction-confirmation` | Existing screens + coachmark | **Catch.** Extraction loader doubles as demo. Confirmation gets a one-time inline callout. |
| 4 | `/review` | Existing screen + coachmark + length cap | **Master.** Review up to 5 cards (or all extracted if fewer). |
| 5 | Existing wild reveal | Existing screen + brand framing | **Read.** Wild sentence with their just-studied words glowing gold. |

Closer: `/welcome` step 3 — **summary** — quietly summarizes what they just did and introduces (does *not* request) the daily reminder idea. The actual notification ask fires after the second session, not in onboarding.

### Per-step build spec

#### Step 1 — Pitch

- **Route:** `/welcome` step state `pitch`.
- **Layout:** Full-page, same washi-paper background as landing. Re-use the stacked-paper hero illustration from `src/app/page.tsx` (extract `HeroDemo` into a shared component so we don't fork the visual).
- **Headline:** *"Catch your first."* (serif, large)
- **Subhead:** *"Three minutes. One photo. A deck shaped by what you actually read."*
- **Progress chip:** `01 / 03 · 撮` mono-uppercase, top-right.
- **CTA:** Single primary button — *"Show me."*
- **Escape:** Small text link, bottom — *"I've used KanjiKatch before — skip this."* Sets `onboardingTourStatus = 'skipped'` and routes to `/dashboard`.

#### Step 2 — Choose your source

- **Route:** `/welcome` step state `source`.
- **Layout:** Two vertically stacked sections.
  - **Top (primary, larger):** *"Use what's in front of you."* Three tiles with concrete how-to:
    - **Take a photo** — opens device camera (mobile) or upload picker (desktop).
    - **Paste a screenshot** — opens the upload picker; copy primes them with "⌘V / Ctrl-V works too."
    - **Pick from your photo library** — opens upload picker filtered to images.
  - **Bottom (secondary, smaller, divided with "or no page handy?"):** *"Borrow one of ours."* Three sample thumbnails, each tagged with a small mono *"guided sample"* pill. Sub-line below the section: *"Borrowed for the demo. Removable in one tap."*
    - **Genki II — page 14** — beginner textbook, clean print, mixed kana/kanji.
    - **A page from a handwritten study notebook** — intermediate, our differentiator (handwriting handling).
    - **A news headline screenshot** — advanced, dense, real-world.
- **Sample handling:**
  - Samples live at `public/samples/{slug}.jpg`. Pre-extracted card data lives at `public/samples/{slug}.json` so we never call Anthropic for samples.
  - Sample-derived cards are flagged in DB with a column on `sourceImages` (`isOnboardingSample boolean default false`). The library lists them with the same *"guided sample"* mono pill and a one-tap "remove sample cards" button in settings. Pill is the same visual on both the sample tile, the extraction confirmation, and the library — visual continuity reinforces that these are borrowed throughout.
- **Progress chip:** `02 / 03 · 撮`.

#### Step 3 — Catch (rides on `/capture` + extraction confirmation)

- **Capture page in onboarding mode:** When `onboardingTourStatus = 'in_progress'`, `/capture` skips its own page heading and renders a thinner top bar with a step indicator. Capture itself is the same code path.
- **Free bonus:** The first capture during onboarding does **not** decrement `starterExtractionsUsed`. Implement via a `bonus: 'onboarding'` flag on the extract request, validated server-side against `onboardingTourStatus`. Microcopy on the capture screen: *"The first one's on us."*
- **Extraction loader rebuilt as a demo (client-side paced reveal, NOT streaming):**
  - `/api/extract` continues to return all-at-once — no protocol change. The loader receives the full response, then **animates the reveal client-side** at a paced cadence.
  - The captured image renders large and slightly desaturated.
  - Individual kanji **lift off the image** one at a time at a fixed cadence (~250ms apart), settling into a row beneath. Use the existing `lit-window` glow vocabulary for emphasis.
  - Live count tickers up in sync with the animation: *"7 kanji caught, 4 words found…"*
  - This replaces any generic spinner. Minimum total animation time is 4s so the magic lands even on the sample path (which resolves instantly). If the real API takes longer than 4s, the loader simply waits for the response, then runs the paced reveal.
- **Confirmation screen:** Existing `extraction-confirmation.tsx`. Add a single inline coachmark above the card list (rendered only when `onboardingTourStatus = 'in_progress'`):
  > *"Review what we caught. Keep what matters, fix anything in a tap."*
- **Continue CTA:** Existing "Add to library" button, relabeled to *"Catch these, then review."* Pre-emptively routes to `/review`.

#### Step 4 — Master (rides on `/review`)

- **First-time framing coachmark:** Single one-time callout above the first card:
  > *"Five cards, then we'll show you something."*
- **Session length cap:** Onboarding review session is capped at `min(5, extractedCardCount)`. Implementation: pass an `?onboarding=1` query param into the review session creation; the API caps the queue at the lower of 5 or available cards. Standard review session creation is unchanged.
- **Per-card UX:** Identical to the existing flashcard — same haptics, same animation, same SRS. Onboarding does **not** alter the review feel.
- **Card 5 (or final) transition:** Instead of dropping back to the dashboard, the card stack visually collapses into a small pile (echoing the landing-page stacked-paper hero), and a serif headline animates in:
  > *"Now — read them in the wild."*
- **Early-exit path (non-coercive, dashboard-tile pattern):** If the user leaves the session before completing the capped count, do **not** intercept the navigation. Let them land on the dashboard. There, render a single prominent tile at the top — the only thing competing for attention:
  > *"Your first sentence is ready."* — sub: *"Built from the cards you reviewed."*
  > Tap expands the tile into the full wild reveal in place (same animation as the standard transition). If the user does not tap it, the tile persists until they engage; closing it explicitly with an x dismisses it and treats onboarding as complete.
  > If they reviewed zero cards and exited, no tile renders — the dashboard shows the standard new-user state and `onboardingTourStatus` stays `in_progress` so they can resume from `/welcome` via the "Resume tour" chip.

#### Step 5 — Read (rides on the wild sentence reveal)

- **Generation:** Use the existing wild-sentence generator. Verify with a deck of 5–10 items that quality is acceptable (see §9 risks). Samples ship with pre-cached fallback sentences in `public/samples/{slug}.json` so the demo path is bulletproof if generation fails or is slow.
- **Reveal animation:** Sentence words build in left to right. Each studied-word glow fires in turn (gold). Partial words (kanji-known but the compound is new) get the teal underline, also in turn. At completion, the english translation fades in below.
- **Framing copy (one line, below the sentence):**
  > *"Built five minutes ago from words you just caught. Every session, fresh ones — calibrated to your library."*

##### Step 5a — Catch one from the wild (the compounding moment)

This is the proof that the library grows from reading. Don't make it a separate screen — make it an inline coachmark that fires once the reveal animation completes.

- **Trigger:** After the english translation fades in, a one-time coachmark points at the first partial (teal-underlined) word in the sentence. If the sentence has no partials, point at the first studied word and switch the coachmark to *"Tap any word to revisit it later."*
- **Coachmark copy:**
  > *"Tap any new word to catch it. Your reading grows your library."*
- **Behavior on tap:** The existing tap-to-add interaction runs unchanged — word lifts into the library with a haptic + the same lit-window glow used elsewhere. A small confirmation chip slides in beneath the sentence: *"Caught. It'll be in tomorrow's review."*
- **Skip-tolerant:** The coachmark is dismissable and the CTA below works whether or not they tap. We *want* them to tap, but onboarding does not block on it. If they skip, the compounding loop is reinforced again the next time they reach a wild sentence in normal use.
- **CTA:** *"Finish onboarding."* Sets `onboardingTourStatus = 'completed'` and routes to `/welcome` step 3.

#### Step 6 — Summary (closing screen)

- **Route:** `/welcome` step state `summary`.
- **Layout:** Quiet, recap-style. Three lines, no buttons except "Go to dashboard."
  - **Top:** Their first kanji (large serif) + count.
  - **Middle:** Their one studied wild sentence (small, ruby readings preserved).
  - **Bottom:** Three short lines, each preceded by a small mono dot:
    - *"Tomorrow, a few more reviews."*
    - *"Capture another page anytime."*
    - *"We'll quietly nudge you in a few days. Change reminders in settings."*
- **No notification prompt here.** The actual permission ask fires after the user's *second* completed session — different module, different doc.

## State

Two new columns on `users`:

```sql
ALTER TABLE users
  ADD COLUMN onboarding_tour_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN welcome_started_at timestamp NULL;
-- onboarding_tour_status values: 'pending' | 'in_progress' | 'completed' | 'skipped'
-- welcome_started_at: set when the user first lands on /welcome; used by the
-- 7-minute time-guardrail fallback (see §9). Stays NULL for users who skipped.
```

Plus one column on `source_images`:

```sql
ALTER TABLE source_images
  ADD COLUMN is_onboarding_sample boolean NOT NULL DEFAULT false;
```

Everything else (hasCaptured, hasReviewed, hasSeenWild) is computed on the fly from existing tables. No new flags table.

**Gate at `/dashboard`:** Server component checks `onboardingTourStatus`. If `pending`, redirect to `/welcome`. If `in_progress`, render normal dashboard (user has left and returned mid-flow) but show a subtle "Resume tour" chip top-right. If `completed` or `skipped`, render normal dashboard.

## File map

### New files

- `src/app/(dashboard)/welcome/page.tsx` — server entry, reads status, renders client orchestrator.
- `src/app/(dashboard)/welcome/welcome-flow.tsx` — client state machine for `pitch | source | summary`.
- `src/app/(dashboard)/welcome/step-pitch.tsx`
- `src/app/(dashboard)/welcome/step-source.tsx` — own/sample picker.
- `src/app/(dashboard)/welcome/step-summary.tsx`
- `src/components/onboarding/coachmark.tsx` — reusable inline callout, gated by `onboardingTourStatus`.
- `src/components/onboarding/progress-chip.tsx` — top-right `0X / 03` indicator.
- `src/components/onboarding/extraction-magic-loader.tsx` — the kanji-lifting-off loader.
- `src/components/onboarding/first-sentence-tile.tsx` — the dashboard tile that renders for users who exited review early; expands inline into the full wild reveal on tap.
- `src/components/onboarding/tap-to-catch-coachmark.tsx` — the one-time coachmark that points at the first partial/studied word in the wild reveal after the animation completes.
- `src/lib/track.ts` — instrumentation shim (see §12). No-ops today; consumes the same call signature when PostHog lands.
- `src/components/shared/stacked-paper-hero.tsx` — extracted from `src/app/page.tsx`'s `HeroDemo`. Re-used on pitch screen.
- `src/lib/onboarding.ts` — server helpers: `getOnboardingStatus`, `markInProgress`, `markCompleted`, `markSkipped`.
- `public/samples/genki-p14.jpg` + `public/samples/genki-p14.json`
- `public/samples/handwritten-notebook.jpg` + `.json`
- `public/samples/news-headline.jpg` + `.json`

### Modified files

- `src/db/schema/index.ts` — add the two columns.
- `src/app/(dashboard)/dashboard/page.tsx` — add redirect-to-welcome gate; remove the existing `isNewUser` empty state (it's superseded by `/welcome`).
- `src/app/(dashboard)/capture/capture-input.tsx` — accept `onboarding` mode prop, render thinner header, set the bonus flag on the extract request.
- `src/app/(dashboard)/capture/extraction-confirmation.tsx` — conditionally render coachmark; conditionally relabel CTA.
- `src/lib/plan-limits.ts` — respect the onboarding bonus flag; verify server-side against `onboardingTourStatus`.
- `src/app/api/extract/route.ts` (or wherever the extract handler lives) — accept and validate the `bonus: 'onboarding'` flag.
- Review session creation API — accept `?onboarding=1`, cap queue length.
- `src/app/(dashboard)/review/` (relevant client component) — render the first-card coachmark when `onboardingTourStatus = 'in_progress'`; intercept early exit; render the card-stack transition.

## Microcopy bank

Every line below is the canonical copy. Don't paraphrase during implementation — these are the strings.

**Pitch screen**
- H1: *Catch your first.*
- Sub: *Three minutes. One photo. A library that grows from what you actually read.*
- Primary CTA: *Show me.*
- Skip: *I've used KanjiKatch before — skip this.*

**Source screen**
- H1: *Snap one page.*
- Sub: *Your handwriting works. So does printed text, a screenshot, a manga panel.*
- Section A label: *Use what's in front of you.*
- Tile 1: *Take a photo*
- Tile 2: *Paste a screenshot* — secondary: *⌘V / Ctrl-V works too.*
- Tile 3: *Pick from your library*
- Section B label: *Or borrow one of ours.*
- Section B sub: *Borrowed for the demo. Removable in one tap.*
- Sample pill (on tile, in confirmation, in library): *guided sample* (mono uppercase)
- Sample 1 label: *Genki II — page 14* / *Beginner · printed*
- Sample 2 label: *A study notebook page* / *Intermediate · handwritten*
- Sample 3 label: *A news headline* / *Advanced · real-world*

**Capture (onboarding mode)**
- Subline under page heading: *The first one's on us.*

**Extraction loader**
- Live status: *{n} kanji caught, {m} words found…*

**Confirmation coachmark**
- *Review what we caught. Keep what matters, fix anything in a tap.*
- Primary CTA: *Catch these, then review.*

**Review coachmark (first card)**
- *Five cards, then we'll show you something.*

**Card stack → wild transition**
- H2: *Now — read them in the wild.*

**Early-exit dashboard tile**
- H3 on tile: *Your first sentence is ready.*
- Sub: *Built from the cards you reviewed.*
- (No primary CTA — the tile itself is the affordance. A small dismiss x is available.)

**Wild reveal framing**
- *Built five minutes ago from words you just caught. Every session, fresh ones — calibrated to your library.*

**Tap-to-catch coachmark (step 5a)**
- *Tap any new word to catch it. Your reading grows your library.*
- On-tap confirmation chip: *Caught. It'll be in tomorrow's review.*
- Primary CTA (always available): *Finish onboarding.*

**Summary screen**
- H1: *That's the loop.*
- Bullet 1: *Tomorrow, a few more reviews.*
- Bullet 2: *Capture another page anytime.*
- Bullet 3: *We'll quietly nudge you in a few days. Change reminders in settings.*
- Primary CTA: *Go to dashboard.*

## Build packages

Sequenced for shippability. Each package is self-contained and reviewable.

### Package A — Schema + state plumbing

- Add `onboardingTourStatus` and `welcomeStartedAt` to `users`; add `isOnboardingSample` to `source_images`.
- Add `src/lib/onboarding.ts` server helpers (`getOnboardingStatus`, `markInProgress`, `markCompleted`, `markSkipped`, `recordWelcomeStart`).
- Add `src/lib/track.ts` instrumentation shim with the full event union from §12. No-ops in prod, console-logs in dev behind `NEXT_PUBLIC_TRACK_DEBUG=1`.
- Add `/dashboard` gate (redirect to `/welcome` when `pending`).
- Backfill: existing users get `'completed'` so they don't see the tour. Migration sets all existing rows to `'completed'`.

### Package B — Welcome screens shell

- `/welcome` route + state machine for `pitch | source | summary`.
- Pitch screen (full implementation).
- Source screen with the three "use yours" tiles. Sample tiles render placeholder thumbnails for now.
- Summary screen (full implementation).
- Skip flow.
- Wire `onboarding_started`, `onboarding_source_chosen`, `onboarding_skipped`, `onboarding_completed` events.

### Package C — Capture in onboarding mode

- Capture page thinner header in onboarding mode.
- Free-bonus flag wiring through `/api/extract`.
- "The first one's on us" microcopy.
- Confirmation-screen coachmark (rewritten copy per §7).
- Wire `onboarding_extraction_started`, `onboarding_extraction_succeeded`, `onboarding_extraction_failed`, `onboarding_cards_saved` events.

### Package D — Sample image pipeline

- Pick the three sample images (see §11 open decisions).
- Pre-extract each via the real extraction pipeline; capture the response as the canonical `public/samples/{slug}.json`.
- Pre-generate a fallback wild sentence per sample and bake into the same JSON.
- Wire sample selection in `step-source.tsx` to fast-path through extraction (skip Anthropic call entirely; load JSON, write rows, mark `isOnboardingSample = true`).
- Render the *guided sample* pill on the sample tile, in the extraction confirmation, and in the library listing.
- Add settings → *"Remove sample cards"* one-tap action (coordinate with `src/app/(dashboard)/dashboard/settings/`).

### Package E — Extraction magic loader (paced reveal)

- Replace the current capture loading state with the paced-reveal animation.
- Important: **client-side paced reveal of an all-at-once API response**, not streaming. `/api/extract` is unchanged. The loader receives the full response, then animates kanji in at ~250ms cadence.
- Live ticker advances in sync with the reveal — never ahead.
- Minimum 4s total animation duration; if the API takes longer, wait for response, then animate.
- Respect `prefers-reduced-motion`: skip the per-kanji animation, show the count ticker and final layout instantly.

### Package F — Review onboarding overlays + dashboard tile

- First-card coachmark.
- Session-length cap when `?onboarding=1`.
- Card-stack → wild transition animation (skipped under reduced-motion).
- **Dashboard early-exit tile** (`first-sentence-tile.tsx`) — renders only when the user has `onboardingTourStatus = 'in_progress'`, has reviewed ≥1 card, and is not currently inside the review flow. Tap expands into the wild reveal in place. Explicit dismiss treats onboarding as completed.
- **Tap-to-catch coachmark** in the wild reveal (Step 5a) — fires once per user after the reveal animation completes; points at the first partial word, or the first studied word if no partials exist.
- `markCompleted` on wild reveal CTA tap **or** explicit dismiss of the dashboard tile.
- Wire `onboarding_first_card_reviewed`, `onboarding_review_completed`, `onboarding_review_exited_early`, `onboarding_wild_revealed`, `onboarding_word_caught_from_wild` events.

### Package G — Time guardrail + resume

- Implement the 7-minute fallback offer (see §9). Renders on whichever step the user is currently stuck on, sourced from `welcomeStartedAt`.
- *Resume tour* chip on `/dashboard` for users with `onboardingTourStatus = 'in_progress'`.
- *Replay onboarding tour* action in settings.
- Wire `onboarding_time_guardrail_offered`, `onboarding_time_guardrail_taken` events.

### Package H — Polish pass

- Haptic audit across the flow. Confirm haptics fire only on: source-tile tap, first capture submit, first card flip, word-caught-from-wild, wild reveal completion. Nowhere else.
- Motion audit: every transition uses the existing `stagger-*` / `lit-window` vocabulary. No new motion idioms.
- Mobile vs desktop parity check.
- Accessibility: every coachmark has a dismissable role, every primary CTA is keyboard-reachable, `prefers-reduced-motion` disables the paced-reveal kanji animation, the card-stack collapse, and the per-word wild-sentence build.
- Microcopy audit: every string matches §7 verbatim. Grep for old strings ("we usually get it right", "Add and review", "Try one of ours") to confirm none survive.

## Failure modes (designed-for, not hoped-against)

| Mode | Symptom | Designed response |
|---|---|---|
| User's own photo extracts 0 cards | Confirmation screen would be empty | Detect 0-card extraction in onboarding mode → show *"Photos sometimes need good light. Try a sample now, come back to yours later."* + sample picker inline. Do **not** consume the bonus credit. |
| Extraction is slow (>30s) | User thinks it's broken | Magic loader runs forever with a soft secondary line *"Big page — still catching."* No spinner switcheroo. |
| Extraction API fails | User stuck | Inline retry with the same image. Bonus credit not consumed. Surface sample picker as the secondary option. |
| Wild sentence generation fails or is poor on small deck | Climax falls flat | Sample-derived decks fall back to the pre-cached sentence in `public/samples/*.json`. Own-photo decks: if generation fails, retry once; if still failing, surface a curated fallback that uses the most common item from their deck inside a simple template. |
| User signs in on second device mid-onboarding | Tour state is per-user (DB-backed), not per-device | Resumes from current `onboardingTourStatus`. If `in_progress`, dashboard chip shows *"Resume tour."* |
| User skips, then wants the tour later | No way back | Settings → *"Replay onboarding tour"* sets status back to `pending`. Their existing data is untouched. |
| Mobile camera permission denied | Can't capture | Fall through to upload picker silently — no scolding modal. |
| Non-Japanese image uploaded | Confusing | Extraction returns 0 cards; treat as the 0-card case above. |
| User has been in onboarding >7 minutes without reaching the wild reveal | Compounding failure (photo retry + slow extraction + slow generation) — session is dragging | Surface a soft inline offer on whichever step they're stuck on: *"Stuck? Try a sample to see the loop now — your photo will still be here."* Tapping it routes to the sample picker without losing any in-progress capture data. Triggered by a single `welcomeStartedAt` timestamp written when the user enters `/welcome`; the offer renders if `now - welcomeStartedAt > 7m` and `onboardingTourStatus = 'in_progress'`. |

## Acceptance criteria

Before merging, every one must pass.

1. New signup → first wild sentence in under 4 minutes on the sample path (measured manually).
2. New signup → first wild sentence in under 8 minutes on the own-photo path (assuming reasonable photo).
3. Skip link works at every step; status is `skipped`; dashboard is normal; settings → replay works.
4. Onboarding capture does **not** decrement `starterExtractionsUsed` (verified by DB read before/after).
5. Sample-derived cards have `isOnboardingSample = true` and can be removed in one action from settings. The *guided sample* pill is visible on the sample tile, the extraction confirmation, and the library listing.
6. Existing users (all currently in DB) see no tour after migration — they're auto-`completed`.
7. Early-exit dashboard tile renders only when at least one card has been reviewed; persists across reloads until tapped or explicitly dismissed.
8. Tap-to-catch coachmark fires exactly once per user, only after the wild reveal animation completes, and never blocks the *Finish onboarding* CTA.
9. The instrumentation shim (§12) fires every milestone event with the documented props; events are visible in dev console behind a debug flag.
10. Lighthouse mobile score on `/welcome` step 1 ≥ 90.
11. Reduced-motion users see the count ticker and the final card layout but no per-kanji lift animation, no card-stack collapse, no per-word build of the wild sentence.
12. Every microcopy string matches §7 verbatim.

## Instrumentation hooks

Analytics is deferred to Package 6 (PostHog or similar). To avoid re-traversing every onboarding surface when we add it, ship a thin shim now.

### Contract

`src/lib/track.ts` exports a single function:

```ts
export function track(event: OnboardingEvent, props?: Record<string, unknown>): void;
```

Today it no-ops in production and logs to console behind `NEXT_PUBLIC_TRACK_DEBUG=1` in dev. When PostHog (or whichever provider) lands in Package 6, the body of `track()` is the only thing that changes.

### Events to emit (every one is a hook the onboarding code must call)

| Event | Fires when | Required props |
|---|---|---|
| `onboarding_started` | User lands on `/welcome` for the first time (status flips `pending → in_progress`) | `userId` |
| `onboarding_source_chosen` | User taps any tile on the source step | `source: 'photo' \| 'paste' \| 'library' \| 'sample'`, `sampleSlug?: string` |
| `onboarding_extraction_started` | The extract request is dispatched | `isSample: boolean` |
| `onboarding_extraction_succeeded` | Extract response received with ≥1 card | `cardsCaptured: number`, `durationMs: number` |
| `onboarding_extraction_failed` | Extract errored or returned 0 cards | `reason: 'api_error' \| 'zero_cards' \| 'non_japanese'`, `durationMs: number` |
| `onboarding_cards_saved` | User taps *Catch these, then review* | `cardsSaved: number` |
| `onboarding_first_card_reviewed` | First card in the onboarding session is rated | `rating: 'again' \| 'hard' \| 'good' \| 'easy'` |
| `onboarding_review_completed` | Capped session finishes naturally | `cardsReviewed: number` |
| `onboarding_review_exited_early` | User leaves the session before the cap | `cardsReviewed: number` |
| `onboarding_wild_revealed` | The wild sentence reveal animation completes | `viaEarlyExitTile: boolean` |
| `onboarding_word_caught_from_wild` | User taps a word in the wild sentence (the compounding moment) | `wordType: 'partial' \| 'studied' \| 'new'` |
| `onboarding_completed` | `onboardingTourStatus` flips to `completed` | `viaWildRevealCta: boolean` |
| `onboarding_skipped` | User taps skip at any step | `atStep: 'pitch' \| 'source' \| 'capture' \| 'review' \| 'wild'` |
| `onboarding_time_guardrail_offered` | The 7-minute fallback offer renders | `atStep: string` |
| `onboarding_time_guardrail_taken` | User accepts the fallback | `atStep: string` |

### Rules

- **Never block on a track call.** Wrap in try/catch internally; emit must never affect UX.
- **Don't proliferate the shim.** Only onboarding milestones go through `track()` for now. General app instrumentation waits for Package 6.
- **One event per real user action.** Don't fire on re-renders, restores, or duplicate clicks.
- **Cross-reference with §6 file map.** Every place that calls `track()` is in a file we already touch — no extra surface to maintain.

## Open micro-decisions (resolve before Package B build)

- **Welcome route placement:** `/welcome` (clean, lives at the top level) or `/dashboard/welcome` (nests inside the authed area)? Default recommend `/welcome` at root of authed routes since it's a full-page takeover.
- **Sample picker UX detail:** show all three samples as thumbnails simultaneously, or one preview with a "switch" affordance? Default recommend all-three-thumbnails — faster decision, more honest about variety.
- **Resume chip styling on dashboard for `in_progress` users:** subtle pill ("Resume tour →"), or a more obvious banner? Default recommend pill.
- **Replay-tour copy in settings:** *"Replay onboarding tour"* (descriptive) or *"Walk through KanjiKatch again"* (warmer)? Default recommend the descriptive one.

## Out of scope for v1

- Pre-signup interactive demo (decided: signup-first).
- JLPT level picker (decided: never in onboarding).
- Notification permission ask (decided: post-second-session, separate module).
- Multi-step "did you know?" tour after onboarding (no — once is enough; we trust the loop to teach itself on repeat).
- Variants / A/B testing scaffolding (deferred to Package 6 Analytics).
- Localized onboarding copy (English only at launch).
