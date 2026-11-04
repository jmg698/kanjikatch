# KanjiKatch Help Center

Drafts of the help-center articles. Each file is standalone Markdown that can be pasted into a help-center tool (Intercom, Zendesk, HelpScout, Notion, etc.).

| # | Article | Covers |
| --- | --- | --- |
| 1 | [Getting started with KanjiKatch](01-getting-started.md) | The core loop, welcome tour, navigation |
| 2 | [Capturing Japanese from photos and text](02-capturing-japanese.md) | Photo/camera/paste, the review-and-save screen, troubleshooting |
| 3 | [How reviews work](03-how-reviews-work.md) | Starting sessions, grading, spaced repetition, stages, undo, shortcuts |
| 4 | [Setting aside, fixing, or deleting a card](04-set-aside-fix-delete-cards.md) | Set aside, Put back, Fix definition, Delete, Restore |
| 5 | [Browsing your library](05-browsing-your-library.md) | Tabs, search, filters, sort |
| 6 | [Reading practice: See It In The Wild](06-see-it-in-the-wild.md) | Post-session sentences, rating, adding words, Read page |
| 7 | [Creating study guides](07-study-guides.md) | Creating, printing, deleting guides |
| 8 | [Tracking your streak and progress](08-streaks-and-progress.md) | Dashboard, streak rules, card stages |
| 9 | [Free vs Pro: plans, limits, and billing](09-free-vs-pro-billing.md) | Extraction quota, trial, upgrade, cancel, resume |
| 10 | [Managing your account and data](10-account-data-privacy.md) | Email/password, export, delete account, privacy, support |

## Editor notes: product vs. marketing mismatches

The articles describe what the app does **today**, taken from the code. While writing them, these gaps turned up between the app and the pricing page, billing page, or Privacy Policy. Decide whether to build the feature or change the copy before publishing.

**Promised but not built:**
- **Audio on sentences** is advertised for Pro on `/pricing`, `/dashboard/billing`, and the free-tier upsell in See It In The Wild, but no audio exists. Article 9 leaves it out.
- **Session recap email** and the **day-6 trial reminder** are advertised, but no email-sending code exists. Article 9 leaves both out.

**Copy that doesn't match the app:**
- The Pro "2 mid-session sentences at card 25" copy doesn't match the app. Reading breaks come every 10 cards, with 1 sentence for everyone.
- **Remove guided sample cards** removes only the sample *source*; the sample cards stay in the library. Article 10 says so.
- Dashboard **Recently Added** legend uses Apprentice / Guru / Master / Known, while the Library uses New / Learning / Reviewing / Known. Article 8 only uses the Library names.

**Data and privacy:**
- **Data export** does not include study guides.
- The **Privacy Policy** says free-tier images are deleted after extraction; there's no code for that. It also doesn't mention study-guide AI processing.

**Billing and account behavior:**
- **Every checkout gets a 7-day trial**, including returning subscribers.
- **Deleting an account doesn't cancel Stripe**. Article 10 warns users.
- **Streak days are UTC.** Article 8 explains it, but local-time streaks would be friendlier.

**Library and review:**
- **No way to delete an active card** from the Library. Users must set it aside in a review first. Article 4 documents the workaround.
- **Set-aside cards can still count as due.** The review page's due count includes them, so the page can show cards "ready" that never load.
