# Onboarding Build Plan

**Status:** v1 build spec
**Supersedes (as build doc):** `ONBOARDING_INSPIRATION.md` — kept as reference for the why; this is the what and how.

## Thesis

The tutorial **is** the loop. By the time onboarding ends, the user has personally completed one full revolution — capture → catch → master → read — and the app already knows them a little. Every screen is a real screen doing real work, not a marketing tour layered over a static dashboard.

The activation metric from `PRO_TIER_PLAN.md` is unchanged and absolute: **1 extraction → 1 review → 1 personalized sentence within 48 hours.** Onboarding delivers all three inside the first session.

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
  - **Bottom (secondary, smaller, divided with "or no page handy?"):** *"Try one of ours."* Three sample thumbnails:
    - **Genki II — page 14** — beginner textbook, clean print, mixed kana/kanji.
    - **A page from a handwritten study notebook** — intermediate, our differentiator (handwriting handling).
    - **A news headline screenshot** — advanced, dense, real-world.
- **Sample handling:**
  - Samples live at `public/samples/{slug}.jpg`. Pre-extracted card data lives at `public/samples/{slug}.json` so we never call Anthropic for samples.
  - Sample-derived cards are flagged in DB with a column on `sourceImages` (`isOnboardingSample boolean default false`). The library lists them with a subtle "sample" pill and a one-tap "remove sample cards" button in settings.
- **Progress chip:** `02 / 03 · 撮`.

#### Step 3 — Catch (rides on `/capture` + extraction confirmation)

- **Capture page in onboarding mode:** When `onboardingTourStatus = 'in_progress'`, `/capture` skips its own page heading and renders a thinner top bar with a step indicator. Capture itself is the same code path.
- **Free bonus:** The first capture during onboarding does **not** decrement `starterExtractionsUsed`. Implement via a `bonus: 'onboarding'` flag on the extract request, validated server-side against `onboardingTourStatus`. Microcopy on the capture screen: *"The first one's on us."*
- **Extraction loader rebuilt as a demo:**
  - The captured image renders large and slightly desaturated.
  - As the extraction API streams results, individual kanji **lift off the image** one at a time, settling into a row beneath. Use the existing `lit-window` glow vocabulary for emphasis.
  - Live count: *"7 kanji caught, 4 words found…"*
  - This replaces any generic spinner. If extraction takes <5s (sample path), pace the animation to a minimum 4s so the magic lands.
- **Confirmation screen:** Existing `extraction-confirmation.tsx`. Add a single inline coachmark above the card list (rendered only when `onboardingTourStatus = 'in_progress'`):
  > *"Every kanji on the page, caught. Tap any card to fix it — but we usually get it right."*
- **Continue CTA:** Existing "Add to library" button, relabeled to *"Add and review."* Pre-emptively routes to `/review`.

#### Step 4 — Master (rides on `/review`)

- **First-time framing coachmark:** Single one-time callout above the first card:
  > *"Five cards, then we'll show you something."*
- **Session length cap:** Onboarding review session is capped at `min(5, extractedCardCount)`. Implementation: pass an `?onboarding=1` query param into the review session creation; the API caps the queue at the lower of 5 or available cards. Standard review session creation is unchanged.
- **Per-card UX:** Identical to the existing flashcard — same haptics, same animation, same SRS. Onboarding does **not** alter the review feel.
- **Card 5 (or final) transition:** Instead of dropping back to the dashboard, the card stack visually collapses into a small pile (echoing the landing-page stacked-paper hero), and a serif headline animates in:
  > *"Now — read them in the wild."*
- **Early-exit interception:** If the user attempts to leave the session before completing the capped count, intercept the navigation with a full-screen takeover (not a confirm dialog):
  > *"Wait — see this first."*
  > A button: *"Show me."* Generates the wild sentence from whatever cards they've reviewed so far (minimum 1). If they review zero cards and try to leave, fall through to the dashboard with the standard empty state — no interception. This is the only path that gracefully exits onboarding without the wild moment.

#### Step 5 — Read (rides on the wild sentence reveal)

- **Generation:** Use the existing wild-sentence generator. Verify with a deck of 5–10 items that quality is acceptable (see §9 risks). Samples ship with pre-cached fallback sentences in `public/samples/{slug}.json` so the demo path is bulletproof if generation fails or is slow.
- **Reveal animation:** Sentence words build in left to right. Each studied-word glow fires in turn (gold). At completion, the english translation fades in below.
- **Framing copy (one line, below the sentence):**
  > *"Built five minutes ago from words you just caught. Every session, fresh ones — calibrated to your deck."*
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

Single new column on `users`:

```sql
ALTER TABLE users
  ADD COLUMN onboarding_tour_status text NOT NULL DEFAULT 'pending';
-- values: 'pending' | 'in_progress' | 'completed' | 'skipped'
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
- `src/components/onboarding/wild-reveal-takeover.tsx` — the "Wait, see this first" interception screen.
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
- Sub: *Three minutes. One photo. A deck shaped by what you actually read.*
- Primary CTA: *Show me.*
- Skip: *I've used KanjiKatch before — skip this.*

**Source screen**
- H1: *Snap one page.*
- Sub: *Your handwriting works. So does printed text, a screenshot, a manga panel.*
- Section A label: *Use what's in front of you.*
- Tile 1: *Take a photo*
- Tile 2: *Paste a screenshot* — secondary: *⌘V / Ctrl-V works too.*
- Tile 3: *Pick from your library*
- Section B label: *Or try one of ours.*
- Sample 1 label: *Genki II — page 14* / *Beginner · printed*
- Sample 2 label: *A study notebook page* / *Intermediate · handwritten*
- Sample 3 label: *A news headline* / *Advanced · real-world*

**Capture (onboarding mode)**
- Subline under page heading: *The first one's on us.*

**Extraction loader**
- Live status: *{n} kanji caught, {m} words found…*

**Confirmation coachmark**
- *Every kanji on the page, caught. Tap any card to fix it — but we usually get it right.*
- Primary CTA: *Add and review.*

**Review coachmark (first card)**
- *Five cards, then we'll show you something.*

**Card stack → wild transition**
- H2: *Now — read them in the wild.*

**Early-exit takeover**
- H2: *Wait — see this first.*
- Primary CTA: *Show me.*

**Wild reveal framing**
- *Built five minutes ago from words you just caught. Every session, fresh ones — calibrated to your deck.*
- Primary CTA: *Finish onboarding.*

**Summary screen**
- H1: *That's the loop.*
- Bullet 1: *Tomorrow, a few more reviews.*
- Bullet 2: *Capture another page anytime.*
- Bullet 3: *We'll quietly nudge you in a few days. Change reminders in settings.*
- Primary CTA: *Go to dashboard.*

## Build packages

Sequenced for shippability. Each package is self-contained and reviewable.

### Package A — Schema + state plumbing

- Add `onboardingTourStatus` to `users` and `isOnboardingSample` to `source_images`.
- Add `src/lib/onboarding.ts` server helpers.
- Add `/dashboard` gate (redirect to `/welcome` when `pending`).
- Backfill: existing users get `'completed'` so they don't see the tour. Migration sets all existing rows to `'completed'`.

### Package B — Welcome screens shell

- `/welcome` route + state machine for `pitch | source | summary`.
- Pitch screen (full implementation).
- Source screen with the three "use yours" tiles. Sample tiles render placeholder thumbnails for now.
- Summary screen (full implementation).
- Skip flow.

### Package C — Capture in onboarding mode

- Capture page thinner header in onboarding mode.
- Free-bonus flag wiring through `/api/extract`.
- "The first one's on us" microcopy.
- Confirmation-screen coachmark.

### Package D — Sample image pipeline

- Pick the three sample images (see §10).
- Pre-extract each via the real extraction pipeline; capture the response as the canonical `public/samples/{slug}.json`.
- Pre-generate a fallback wild sentence per sample and bake into the same JSON.
- Wire sample selection in `step-source.tsx` to fast-path through extraction (skip Anthropic call entirely; load JSON, write rows, mark `isOnboardingSample = true`).
- Add settings → *"Remove sample cards"* one-tap action (Package 3 territory; coordinate with `src/app/(dashboard)/dashboard/settings/`).

### Package E — Extraction magic loader

- Replace the current capture loading state with the kanji-lift animation.
- Live ticker showing extracted counts as the API streams.
- Minimum 4s display duration when extraction is faster than that.

### Package F — Review onboarding overlays

- First-card coachmark.
- Session-length cap when `?onboarding=1`.
- Card-stack → wild transition animation.
- Early-exit takeover screen.
- `markCompleted` on wild reveal continue.

### Package G — Polish pass

- Haptic audit across the flow. Confirm haptics fire only on: source-tile tap, first capture submit, first card flip, wild reveal completion. Nowhere else.
- Motion audit: every transition uses the existing `stagger-*` / `lit-window` vocabulary. No new motion idioms.
- Mobile vs desktop parity check.
- Accessibility: every coachmark has a dismissable role, every primary CTA is keyboard-reachable, prefers-reduced-motion disables the magic loader animation and shows the count ticker only.

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

## Acceptance criteria

Before merging, every one must pass.

1. New signup → first wild sentence in under 4 minutes on the sample path (measured manually).
2. New signup → first wild sentence in under 8 minutes on the own-photo path (assuming reasonable photo).
3. Skip link works at every step; status is `skipped`; dashboard is normal; settings → replay works.
4. Onboarding capture does **not** decrement `starterExtractionsUsed` (verified by DB read before/after).
5. Sample-derived cards have `isOnboardingSample = true` and can be removed in one action from settings.
6. Existing users (all currently in DB) see no tour after migration — they're auto-`completed`.
7. Early-exit takeover fires only when at least one card has been reviewed.
8. Lighthouse mobile score on `/welcome` step 1 ≥ 90.
9. Reduced-motion users see the count ticker but no kanji animation.
10. Every microcopy string matches §7 verbatim.

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
