# Kanji Katch — Pro Tier Plan

**Status:** v3 reference document
**Last updated:** 2026-05-13

## Thesis

Free preserves the core habit loop and includes real Pro previews. Pro upgrades the most emotionally valuable moments — personalization, audio, scale, and a study recap that follows users into their inbox. Priced premium because the product is.

---

## Tier Matrix (public-facing)

| | Free | Pro |
|---|---|---|
| Extractions | 10 to start + 5/month (no rollover) | Unlimited for personal study (fair use) |
| Reviews & lookups | Unlimited | Unlimited |
| Mid-session (card 25) | 1 real personalized sentence, no audio | 2 personalized sentences with audio |
| Post-session sentences | 2 from shared library, no audio | 3–5 personalized, with audio |
| "Too hard" → bonus sentence | — | ✓ (capped 1/session) |
| Audio | — | All sentences |
| Uploaded images | Deleted after extraction | Retained, re-extractable, history view |
| Sentence recap emails | Generic study reminders only | Session sentences emailed with audio links |
| On cancellation | n/a | Everything kept; reverts to free limits going forward |

"Unlimited" copy is paired with a fair-use clause in ToS.

---

## Pricing

- **Founders:** $7/mo or $70/yr — first 100 paid subscribers, locked in **while subscription remains active**
- **Standard:** $10/mo or $100/yr

---

## Pro Preview System

Free users experience real Pro value on a planned cadence — not just teases:

| Preview moment | Frequency | Approx. cost |
|---|---|---|
| Mid-session at card 25 | Every free session reaching 25 cards | ~$0.005 |
| Audio play on a library sentence | 1× per week per active free user | ~$0.003 |
| "Too hard" bonus example | First time per month | ~$0.005 |

Each preview closes with the same line in WaniKani voice: *"Pro makes every session like this."*

Total marginal cost per free user: ~$0.10 / month.

---

## The Three Walls

1. **Extraction wall** (primary conversion event in v3): "You've used your extractions for May. 5 more on June 12, or try Pro free for 7 days — unlimited extractions, audio, and personalized sentences."
2. **Post-session wall** (after sentence 2): "That's your 2 free sentences. Pro adds 3–5 personalized + audio."
3. **Mid-session preview** (card 25): Not a wall — a free preview that demonstrates Pro value.

**Trial:** 7 days, credit card required, day-6 reminder, cancel any time. Offered at each wall.

---

## Pro Session Recap Emails

After every completed review session, Pro users receive an email containing:

- The 3–5 sentences from their session
- Audio playback links (or attached audio where practical)
- Session stats (cards reviewed, accuracy)
- One-tap link back into the app

**Frequency control (Pro setting):**

- `Per session` (default)
- `Daily digest`
- `Weekly digest`

**Why this matters:** Sentences leave the app and enter the user's inbox — usable on a commute, train ride, or at lunch. Creates a passive learning surface and reinforces the "cancel = lose forward motion" hook.

**Free users receive:** Generic study reminder emails only — no sentence content. E.g., *"It's been 3 days — your review deck is ready when you are."*

**Marginal cost:** Near zero. Sentences already generated, audio already cached.

---

## Activation Metric (north star)

A user is **activated** when, within 48 hours of signup, they complete:

**1 extraction → 1 review session → 1 personalized sentence viewed**

Everything in onboarding optimizes for this. Conversion correlates with activation.

---

## Conversion Funnel

1. Landing page → concrete Pro demo (before/after with audio)
2. Signup
3. First extraction
4. First review session
5. First personalized sentence preview ← **activation**
6. Repeat sessions, hits extraction wall
7. Trial start
8. First full Pro session (audio + 3–5 sentences + emailed recap)
9. Convert

---

## Email Loop (ship with launch)

| Email | Audience | Trigger |
|---|---|---|
| Welcome | All | Signup — "Get value in 5 minutes" |
| Activation nudge | Not-yet-activated | 48h after signup if not activated |
| Monthly extraction reset | Free | Day extractions refresh |
| Generic study reminder | Free | After 3 days of inactivity |
| Session recap | Pro | After every completed session (configurable frequency) |
| Trial day 1 | Trial user | "Here's what Pro unlocks" |
| Trial day 6 | Trial user | Reminder + easy cancel link |
| Post-cancellation | Lapsed Pro | "Your reviews and cards are saved" |

---

## Referral Hook (lightweight v1)

After a strong session, offer "Share your week" — a tasteful card: 3 kanji learned, one favorite sentence, optional audio link. Zero marginal cost. Identity-driven growth.

---

## Cost Protection (backend, not user-facing)

- Global daily $ ceiling with circuit breaker
- Hidden per-user token cap above visible limits
- Per-IP throttle on `/api/extract`
- Pro daily generation cap (server-enforced, suggested ~200 sentences/day)
- Shared sentence library pre-seeded at launch (~$30 one-time)

---

## Cancellation Policy

Everything stays. Cards, history, difficulty profile, cached audio — all preserved. The subscription reverts to free limits on **new** actions:

- Existing cards: all reviewable forever
- New extractions: reset to free monthly cap going forward
- Audio on already-generated sentences: still plays
- New audio generation: stops
- Session recap emails: stop
- Difficulty profile and ratings: preserved for possible re-subscription

---

# Internal: Comped Pro Tier (NOT public-facing)

**Purpose:** Manual Pro access for early adopters, sensei, friends, beta testers, and other strategic users at the founder's discretion.

**Behavior:** Functionally identical to a paid Pro subscription. Same features, same email recaps, same audio, same unlimited extractions.

## Implementation notes

- Add a `subscription_tier` enum to the users table with values: `free`, `pro`, `pro_comped`
- All Pro feature gates check `subscription_tier IN ('pro', 'pro_comped')`
- `pro_comped` users do NOT go through the trial flow or see any payment-related copy
- Suggested metadata fields: `comped_by`, `comped_reason`, `comped_at`
- Set manually via direct DB update (Neon console or SQL) — no admin UI in v1
- Not surfaced in marketing, pricing pages, or ToS

## Do NOT

- Mention the comped tier in any user-facing copy, FAQ, or pricing page
- Allow self-service application or "comp code" signup
- Count comped users toward the Founders 100 cohort
- Track comped users in conversion or revenue metrics

---

## Not in v1 / backlog

### Periodic knowledge scans + smart suggestions

**Pitch:** Periodically scan a user's existing knowledge and surface kanji/vocab worth adding next. Suggestions should be *smart* — same approximate level as what they already know, and biased toward characters/words that appear in the material they actually read.

**Inputs we already have:**
- The user's library (current kanji + vocabulary, with SRS state — so we know what's mastered vs. struggling vs. new).
- The user's source images (Pro retains them per the tier matrix), giving us a corpus of "what this user is actually reading."
- Extraction history (every kanji/vocab we've ever pulled for them, even ones they didn't keep).

**Suggestion signals (rough ranking inputs):**
- Frequency in the user's own image corpus that *isn't yet in their library*.
- Common companions / collocations of items already in library (e.g., suggests 帰る if 行く + 来る are both known).
- Approximate JLPT/grade-level match to the bulk of their library — avoid lobbing N1 at an N4 reader.
- "Almost there" items: kanji that appeared in their images but were dropped during confirmation.

**Free vs Pro split:**

| | Free | Pro |
|---|---|---|
| Scan cadence | One-time "starter" suggestion set (~3 items) when library passes a small threshold, then nothing | Weekly automated scan |
| Suggestions per cycle | 3 (one-time) | 5–10 |
| Source signal | Library only (no image corpus — free users' images are deleted post-extraction) | Library + retained image corpus + extraction history |
| Surface | Dashboard card, dismissible | Dashboard card + included in session recap email |
| "Why this?" rationale | Generic ("popular at your level") | Personalized ("appears 4× in images you captured this month; pairs with 食べる which you've mastered") |
| One-tap add to library | ✓ | ✓ |

The free version is intentionally a Pro preview — it demonstrates the mechanic once, then the Pro pitch is "this happens every week and uses what you're actually reading."

**Cost / infra notes:**
- Generation is a Claude call per scan. Cache aggressively; nothing here is real-time.
- Run as a cron job (see LAUNCH_PLAN Package 9) — weekly per active Pro user, batched.
- Needs a `suggestions` table (user_id, item, kind, rationale, source_signal, generated_at, status: pending/added/dismissed) so we don't re-suggest dismissed items and can measure add-through rate.
- Counts toward the per-user token budget; needs a hard cap so a user with thousands of images doesn't blow it up.

**Open questions:**
- Cadence: fixed weekly vs adaptive (more often for power users, less for dormant)?
- How aggressively to re-surface dismissed items after time passes?
- Do we need explicit consent to scan retained images for this purpose, or does the existing ToS/Privacy cover it? (Probably the latter, but verify before shipping.)
- What's the right empty-state when a user has <20 library items or <3 images? Fall back to generic JLPT recommendations or skip entirely.

### Other backlog items

- JLPT mock mode
- Topic / context selection
- Streaks
- Lapsed-user reactivation campaigns
- Card-free trial variant
- Self-service comp codes

---

## Open Decisions

1. **Founders cohort definition:** first 100 paid subscribers (excluding trial starts and comped users)
2. **Audio provider:** OpenAI TTS at launch (~$0.003/sentence); revisit if quality complaints arise
3. **Pro daily generation cap exact value:** 200 sentences/day suggested
4. **Session recap default frequency:** `per session` recommended; `daily/weekly digest` available in settings
5. **Landing page demo content:** which kanji set and sentence to feature
6. **UI placement** for the "X/Y extractions used this month" counter
