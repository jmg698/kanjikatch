# Kanji Katch Launch Build Plan

Reference document for taking Kanji Katch from feature-complete app to paid SaaS launch.

The product (capture → extract → library → SRS review → "in the wild") is launch-ready. The business layer (payments, legal, support, analytics, onboarding) is not. This plan groups the missing work into **packages** — chunks that should land together because they share code paths, mental context, or downstream dependencies.

Packages are roughly ordered, but several can run in parallel (see execution order at the bottom).

---

## Package 0 — Anthropic cost containment

**Why grouped:** Single-day, single-concern, blocks nothing but blocks *you* from going broke the moment anyone signs up. Do this first regardless of what else you decide.

- Per-user monthly token budget (track in DB or Redis).
- Global daily $ ceiling with circuit breaker (return graceful error when tripped).
- Sentry alert on spend velocity (events/minute crossing threshold).
- Per-IP throttle on `/api/extract` and `/api/sentences/generate` as a second line of defense against authenticated abuse.
- Decision: do tokens count against the per-user budget, or do request counts? (Recommend tokens — protects you from a few huge images.)

---

## Package 1 — Pricing strategy decisions (no code)

**Why grouped:** These are upstream of every billing decision. Lock them down before writing any Stripe code or you'll redo work.

- Number of paid tiers (recommend one: "Pro").
- Free tier ceiling (extractions/week, total kanji+vocab cap, sentence generations/day).
- Pro tier limits (or unlimited?).
- Pricing: monthly / annual / lifetime?
- Trial model: freemium (recommended) vs time-limited trial.
- Refund policy.
- Grandfathering policy for early users.

Output: a one-page decision doc that drives Package 2.

---

## Package 2 — Billing & subscriptions

**Why grouped:** Stripe schema, webhooks, gating, and pricing UI all touch the same code paths. Splitting them creates partial states (a gate with no Stripe, or Stripe with no gate). Land as one feature.

- Stripe account + products + price IDs (test mode first).
- DB schema: `subscriptions` table (stripe_customer_id, stripe_subscription_id, status, plan, current_period_end) — likely on `users` directly.
- Webhook handler at `/api/webhooks/stripe`: checkout completed, subscription updated/deleted, invoice payment failed.
- Checkout flow: button → Stripe Checkout → redirect back.
- Customer Portal link from `/dashboard/billing`.
- Feature-gating helper (`assertWithinPlanLimits(userId, action)`) — used in extract, sentence-gen, and any other gated route.
- Rewire existing rate limits in `src/lib/rate-limit.ts` to read from plan, not hardcoded.
- `/pricing` page (replaces the FAQ hand-wave).
- "Upgrade" CTAs on relevant empty/limit-reached states.

---

## Package 3 — Legal & account lifecycle

**Why grouped:** ToS, Privacy, data deletion, data export, and the Clerk-deletion webhook are all the same trust narrative. They also all touch the user record. Doing them together means you write the cascade-delete once and the privacy policy correctly describes what actually happens.

- ToS draft (cover: user content, AI processing, subscription terms, refund policy).
- Privacy Policy draft (name every subprocessor: Clerk, Neon, Anthropic, Uploadthing, Sentry, Stripe, Resend).
- `/terms`, `/privacy` pages.
- Site footer with legal links + support email.
- Audit the Clerk `user.deleted` webhook — confirm it cascades to every table (sourceImages, kanji, vocabulary, sentences, reviewSessions, reviewHistory, userStats, generatedSentences, generatedSentenceTargets, reviewTracks, contentItems). FK constraints likely cover it but verify.
- "Delete my account" button in settings (calls Clerk's user delete; cascade does the rest).
- Data export endpoint: zip of JSON or CSV per table.
- Cookie disclosure if you add analytics (Package 6).

---

## Package 4 — Email infrastructure + transactional flows

**Why grouped:** Once Resend is wired up and you have a base email layout, adding each individual email is cheap. Don't drip them in one-by-one across weeks — set up the system, then write all the templates in one sitting.

- Resend account, domain, DKIM/SPF/DMARC.
- Email layout component + send helper.
- Templates:
  - Welcome (triggered on Clerk `user.created`).
  - Trial/upgrade nudges (if applicable per Package 1).
  - Failed-payment dunning (triggered by Stripe webhook from Package 2).
  - Daily review reminder (cron — see Package 9).
  - Weekly progress recap (cron).
- Unsubscribe / notification preferences table.

---

## Package 5 — Onboarding & first-run experience

**Why grouped:** These all live in the new-user pathway and share state ("has this user done X yet?"). Doing them together avoids three different "first-time" flags.

- `userStats` or new `onboardingState` flags: `hasCaptured`, `hasReviewed`, `hasSeenTour`.
- Welcome modal on first dashboard visit.
- Empty-state CTAs on `/dashboard`, `/library`, `/review` pointing forward.
- Sample image asset users can capture without supplying their own.
- 3-step inline tour (capture → confirm → review).
- Welcome email from Package 4 reinforces the loop.

---

## Package 6 — Product analytics

**Why grouped:** Instrument the whole funnel in one pass. Drip instrumentation is how you end up with half the funnel measured and the wrong conclusions for six months.

- PostHog (recommended — has session replay + feature flags built in) or Mixpanel.
- Events: signup, first_capture, capture_completed, extraction_failed, first_review, review_session_completed, upgrade_clicked, checkout_started, checkout_completed, churned.
- User identification (link PostHog user to Clerk ID).
- Funnel dashboard: signup → activation → trial → paid.
- Retention dashboard (D1/D7/D30).
- Feature flag scaffolding (for safer rollouts post-launch).

---

## Package 7 — Support surface

**Why grouped:** Contact, docs, and the in-app feedback button are all "user gets stuck → user gets unstuck." One feedback widget can route to all of them.

- `support@kanjikatch.com` (or routed via Plain/Crisp/Helpscout).
- `/help` section or external docs (Mintlify, GitBook, or just MDX in the app).
- Expand FAQ with: failed extractions, what counts toward limits, billing questions, refunds, data export.
- "Report a bad extraction" button on extraction confirmation screen — writes to a `feedback` table or fires to Linear/email.
- Generic in-app feedback widget (footer or sidebar).

---

## Package 8 — Account settings page

**Why grouped:** All the per-user knobs in one place. Overlaps with Package 3 (data export, delete account) and Package 4 (notification prefs) — pull those into this one UI surface.

- `/dashboard/settings` route.
- Profile (email, display name — via Clerk).
- Billing link (deep link to Stripe portal — from Package 2).
- Daily goal slider (already in `userStats.dailyGoal`, just needs UI).
- Notification preferences (from Package 4).
- Data export button (from Package 3).
- Delete account button (from Package 3).

---

## Package 9 — Background jobs / cron

**Why grouped:** Once you have one scheduled-job mechanism, adding more is trivial. Decide on the mechanism once (Vercel Cron is simplest given the stack).

- Vercel Cron config.
- Daily review reminder job (sends to users with overdue cards + reminder pref on).
- Weekly recap job.
- Vocabulary enrichment retry job (already has `needsEnrichment` flag in schema — likely needs a scheduled trigger).
- Stripe subscription state reconciliation (defense against missed webhooks).

---

## Package 10 — CI/CD & test coverage

**Why grouped:** Parallel-track this with Packages 2–6. Should be running before you ship paid features, but doesn't block design work.

- GitHub Actions: typecheck, lint, vitest, `next build` on every PR.
- Vitest coverage for: `srs.ts`, `validations.ts`, plan-gating helper, Stripe webhook handler.
- Playwright E2E for: signup → capture → confirm → review, and signup → upgrade → portal.
- Staging environment (Vercel preview already covers most; consider a long-lived `staging` branch with its own Neon branch).
- `.env.example` updated with every new key (Stripe, Resend, PostHog).

---

## Package 11 — SEO & shareability

**Why grouped:** All landing-page polish. One sitting.

- `sitemap.xml`, `robots.txt`.
- OG image + Twitter card meta (for `/`, `/pricing`, `/help`).
- Structured data (SoftwareApplication schema).
- Lighthouse pass on `/` and `/pricing`.

---

## Package 12 — Operational hygiene

**Why grouped:** Production-day checklist items. Light effort each but a coherent "we're a real business" pass.

- Uptime monitor (BetterStack or Uptime Robot) + public status page.
- Verify Neon backups + document recovery runbook.
- `vercel.json` with region pinned near Neon region.
- Security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy) in `next.config.js`.
- Sentry release tagging tied to git SHA.
- Runbook doc: "what to do if Anthropic is down / Clerk is down / Stripe webhook is failing."

---

## Suggested execution order

| Week | Primary | In parallel |
|---|---|---|
| 1 | Package 0, then Package 1 (decisions), then start Package 2 | Package 10 (CI scaffolding) |
| 2 | Finish Package 2 (billing), Package 3 (legal) | Package 11 (SEO) |
| 3 | Package 4 (email) + Package 5 (onboarding) | Package 6 (analytics) |
| 4 | Package 7 (support) + Package 8 (settings) + Package 9 (cron) | Package 12 (ops) |
| 5 | Soft launch to small audience, fix what breaks | — |
| 6 | Broad launch | — |

The dependency chain that actually matters: **0 → 1 → 2 → everything else**. Anything before Package 2 ships is wasted polish if your billing model changes. Anything after Package 2 can be reordered based on what feels most painful in your soft-launch feedback.

---

## Current state snapshot (as of plan creation)

**What's already done:**
- Core learning loop (capture, AI extraction via Claude, library, dual-track SM-2 SRS, "in the wild" sentence generation).
- Auth via Clerk (sign-up/sign-in, OAuth, webhook user sync).
- Sentry error tracking + global error boundary.
- Drizzle schema with 12 tables, indexed for review queue performance.
- Rate limiting (200 extractions/week, 20 generations/day) — not yet tied to billing.
- Landing page with hero, how-it-works, comparison vs Anki/WaniKani, FAQ.
- Zod input validation, SSRF protection on image URLs.
- Mobile-responsive UI, PWA manifest, keyboard shortcuts in review.

**What's missing (everything in this plan):**
- Payments (no Stripe).
- Legal docs (no ToS, no Privacy Policy, no footer links).
- Transactional email beyond Clerk's defaults.
- Product analytics.
- Onboarding flow.
- Support surface.
- CI/CD pipeline.
- Cost controls on the Anthropic API.

Realistic timeline to confident paid launch: **4–6 weeks** of focused work.
