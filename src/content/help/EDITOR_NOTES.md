# Help Center: editor notes

Internal notes. This file is not rendered. Articles in this folder are served at `/help/<file name>`. Titles, descriptions, categories and related links live in `src/lib/help-center.ts`, so adding an article takes two steps: add a `.md` file here and add an entry to `HELP_ARTICLES`. Bump `HELP_LAST_UPDATED` when you revise articles.

"Was this helpful?" votes are stored in `help_article_feedback` (see `scripts/sql/0006_help_feedback.sql` for a summary query).

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
