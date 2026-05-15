# Onboarding Inspiration

Reference notes for a future onboarding overhaul. Inspired by the Stash screenshot-organizer app's first-run flow. The goal is to capture *why* their onboarding works so we can adapt the pattern to KanjiKatch, not copy it screen-for-screen.

## Why their flow works

It's short, it's visual, and **it makes you do the setup as part of the tutorial** — by the time the user finishes "learning" the app, the app is already configured and they've performed the core action once. That's the hook.

## The three screens they nail

### Screen 1 — The pitch (one sentence, big serif)

- **Headline:** "Save stuff. Find stuff." — outcome-focused, no jargon.
- **Subhead in brand color:** "Your camera roll will thank you." — adds a tiny emotional payoff.
- **Visual:** a phone mockup demoing the very next action ("Tap Share or Send"), so you see what you're about to do before you do it.
- **Progress bar** at top (7 segments) — signals "this is short, I can finish."
- **Primary CTA:** "Show Me" — curious, low-commitment verb.
- **Escape hatch:** tiny "Already set up on another device? Skip tutorial" link. Respects returning users without cluttering the main CTA.

### Screen 2 — The mental model in one diagram

- **Headline:** "Three taps. That's it." — promises minimal effort, sets expectations.
- **Subhead:** "Faster than screenshotting. And way less embarrassing." — pokes at the competing behavior they're replacing.
- **Core diagram:** `See it → Share it → Stash it` (three icons in a row with arrows). The user now has the mental model in one glance.
- **Content categories grid:** Screenshots, Links, Reels, Places, To-dos, Anything. Shows breadth without overwhelming. "Anything" is a clever catch-all that prevents "but what about X?" objections.
- **Primary CTA:** "Let Me Try" — escalates the verb from "Show Me" to active participation.

### Screen 3 — Do the setup, right now

This is the screen we should steal hardest. It's where most apps fail.

- **Headline:** "Pin Stash to your share sheet" — concrete, action-oriented.
- **Urgency framing:** "You need to do this to save things. It only takes 30 seconds." — explains *why* it's required and caps the perceived cost.
- **Interactive demo card:** mini phone mockup showing exactly what to tap, captioned "Tap the button on this screen."
- **Real action button:** "Open Share Sheet" — actually launches the OS sheet from inside the tutorial.
- **Self-report checkbox:** "I've pinned Stash to my share sheet" — gives users agency to confirm completion (since the app can't programmatically detect it).
- **Primary CTA:** "Continue" — gated until they've checked the box.
- **Fallback:** "Still stuck? Watch how" — a video escape hatch that prevents drop-off without cluttering the main path.

## Patterns to adopt for KanjiKatch

| Pattern | Stash example | KanjiKatch adaptation |
|---|---|---|
| Outcome headline | "Save stuff. Find stuff." | "Snap notes. Learn kanji." or similar |
| Emotional subhead | "Your camera roll will thank you." | Something self-deprecating about Anki / flashcards |
| Three-step mental model | See → Share → Stash | Capture → Extract → Review |
| Content type grid | Screenshots / Links / Reels… | Kanji / Vocabulary / Sentences / Handwritten notes / Textbook pages |
| Forced first action | Pin to share sheet | Capture (or upload) your first image; OR import a sample image we provide |
| Self-report checkbox | "I've pinned…" | "I uploaded my first photo" — though for us we can actually detect this |
| Escalating CTA verbs | Show Me → Let Me Try → Continue | Same shape, our verbs |
| Skip for returning users | "Already set up on another device?" | "Already have an account? Sign in" |
| Help fallback | "Still stuck? Watch how" | Same — short video / GIF |

## Design principles to internalize

1. **Big serif headlines + short sans subheads.** It feels editorial, not SaaS-y. Worth considering as a brand direction.
2. **Progress bar from the first screen.** Even if it's just 4–5 segments, it telegraphs "this ends."
3. **Every screen has one job.** Pitch / mental model / setup action. No screen tries to do two things.
4. **CTAs are verbs the user is actually doing**, not generic "Next."
5. **The tutorial *is* the setup.** Don't teach the app and then ask the user to configure it — fold the configuration into the teaching. For us, this likely means: the user uploads their first real image (or a provided sample) before they leave onboarding, and we run the extraction live so they see the magic.
6. **Always provide an out.** Skip tutorial for returning users, "Still stuck?" fallback for confused ones. The main path stays clean because the escapes are small.
7. **One required commitment per screen.** Either a tap, a checkbox, or a CTA — never two.

## What to NOT copy

- The seven-screen length is fine for them because each screen is genuinely doing work. Don't pad to seven if we only need four.
- "Anything" as a category works for a generic stash app, but we should resist the temptation to be that broad. KanjiKatch is opinionated and that's a feature.
- Their pastel-per-screen palette is charming but is their brand. We should pick our own color logic.

## Open questions for when we build this

- What's the equivalent of "pinning the share sheet" for us — i.e., the one piece of setup that, if skipped, makes the app useless? Candidates: notification permission for review reminders, JLPT level selection, first photo capture.
- Do we provide a sample image so users can complete the loop even without their own notes handy? (Strongly recommend yes — removes the "I'll come back to this later" exit.)
- Where does account creation sit relative to the tutorial? Stash appears to onboard *before* requiring an account. We should consider doing the same so users see value before the signup wall.
