import { readFileSync } from "node:fs";
import path from "node:path";

// Help center content. Article bodies live as Markdown in src/content/help;
// this registry owns everything around them (titles, categories, ordering,
// related links) so the pages can be built and searched without parsing
// front matter. EDITOR_NOTES.md in that folder is for us, not users, and is
// never rendered.

export type HelpCategoryId = "getting-started" | "reviewing" | "library" | "billing" | "account";

export interface HelpCategory {
  id: HelpCategoryId;
  title: string;
  description: string;
}

export interface HelpArticleMeta {
  slug: string;
  title: string;
  description: string;
  category: HelpCategoryId;
  related: string[];
}

export interface HelpArticle extends HelpArticleMeta {
  body: string;
}

export interface HelpHeading {
  id: string;
  text: string;
}

export const HELP_SUPPORT_EMAIL = "support@kanjikatch.com";

// Bump when the articles are revised; shown on every article.
export const HELP_LAST_UPDATED = "November 4, 2026";

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: "getting-started",
    title: "Getting started",
    description: "Set up your account and capture your first page.",
  },
  {
    id: "reviewing",
    title: "Reviewing & reading",
    description: "Spaced repetition, practice sentences, and your streak.",
  },
  {
    id: "library",
    title: "Your library",
    description: "Browse, search, and manage your cards and study guides.",
  },
  {
    id: "billing",
    title: "Plans & billing",
    description: "Free vs Pro, extraction limits, trials, and cancelling.",
  },
  {
    id: "account",
    title: "Account & privacy",
    description: "Sign-in details, exporting your data, and deleting your account.",
  },
];

export const HELP_ARTICLES: HelpArticleMeta[] = [
  {
    slug: "getting-started",
    title: "Getting started with KanjiKatch",
    description: "Take the welcome tour, learn the capture-review-read loop, and find your way around.",
    category: "getting-started",
    related: ["capturing-japanese", "how-reviews-work"],
  },
  {
    slug: "capturing-japanese",
    title: "Capturing Japanese from photos and text",
    description: "Add a photo, screenshot, or pasted text, then check and save what KanjiKatch finds.",
    category: "getting-started",
    related: ["browsing-your-library", "study-guides", "plans-and-billing"],
  },
  {
    slug: "faq",
    title: "Frequently asked questions",
    description: "Quick answers about capturing, reviewing, your library, and your plan.",
    category: "getting-started",
    related: ["getting-started", "how-reviews-work"],
  },
  {
    slug: "how-reviews-work",
    title: "How reviews work",
    description: "Start a session, grade your cards, and understand when they come back.",
    category: "reviewing",
    related: ["set-aside-fix-delete-cards", "see-it-in-the-wild", "streaks-and-progress"],
  },
  {
    slug: "set-aside-fix-delete-cards",
    title: "Setting aside, fixing, or deleting a card",
    description: "Take a card out of rotation, fix a wrong definition, or remove it for good.",
    category: "reviewing",
    related: ["how-reviews-work", "browsing-your-library"],
  },
  {
    slug: "see-it-in-the-wild",
    title: "Reading practice: See It In The Wild",
    description: "Read sentences built from the words you just reviewed, and add new words from them.",
    category: "reviewing",
    related: ["how-reviews-work", "browsing-your-library"],
  },
  {
    slug: "streaks-and-progress",
    title: "Tracking your streak and progress",
    description: "What your dashboard shows, how streaks are counted, and when a card is Known.",
    category: "reviewing",
    related: ["how-reviews-work", "browsing-your-library"],
  },
  {
    slug: "browsing-your-library",
    title: "Browsing your library",
    description: "Search, filter, and sort your kanji, vocabulary, grammar, and sentences.",
    category: "library",
    related: ["set-aside-fix-delete-cards", "how-reviews-work"],
  },
  {
    slug: "study-guides",
    title: "Creating study guides",
    description: "Turn one or more captures into a printable lesson handout.",
    category: "library",
    related: ["capturing-japanese", "browsing-your-library"],
  },
  {
    slug: "plans-and-billing",
    title: "Free vs Pro: plans, limits, and billing",
    description: "How extractions work, starting a trial, and managing or cancelling Pro.",
    category: "billing",
    related: ["capturing-japanese", "account-and-data"],
  },
  {
    slug: "account-and-data",
    title: "Managing your account and data",
    description: "Change your sign-in details, export your data, or delete your account.",
    category: "account",
    related: ["plans-and-billing", "getting-started"],
  },
];

export const POPULAR_ARTICLE_SLUGS = [
  "getting-started",
  "how-reviews-work",
  "capturing-japanese",
  "plans-and-billing",
  "set-aside-fix-delete-cards",
  "faq",
];

const CONTENT_DIR = path.join(process.cwd(), "src", "content", "help");

export function getArticleMeta(slug: string): HelpArticleMeta | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

export function getCategory(id: HelpCategoryId): HelpCategory {
  const category = HELP_CATEGORIES.find((c) => c.id === id);
  if (!category) throw new Error(`Unknown help category: ${id}`);
  return category;
}

export function getArticlesInCategory(id: HelpCategoryId): HelpArticleMeta[] {
  return HELP_ARTICLES.filter((a) => a.category === id);
}

export function getArticle(slug: string): HelpArticle | undefined {
  const meta = getArticleMeta(slug);
  if (!meta) return undefined;
  const body = readFileSync(path.join(CONTENT_DIR, `${slug}.md`), "utf8");
  return { ...meta, body };
}

/** Anchor id for a heading. Shared by the renderer and the table of contents. */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[*_`]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** The article's H2s, in order, for the table of contents. */
export function extractHeadings(body: string): HelpHeading[] {
  return body
    .split("\n")
    .filter((line) => line.startsWith("## "))
    .map((line) => {
      const text = line.slice(3).replace(/[*_`]/g, "").trim();
      return { id: slugifyHeading(text), text };
    });
}

/** Markdown reduced to plain words, for the client-side search index. */
export function toPlainText(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`|]/g, " ")
    .replace(/-{3,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface HelpSearchEntry {
  slug: string;
  title: string;
  description: string;
  categoryTitle: string;
  headings: string[];
  text: string;
}

export function buildSearchIndex(): HelpSearchEntry[] {
  return HELP_ARTICLES.map((meta) => {
    const article = getArticle(meta.slug)!;
    return {
      slug: meta.slug,
      title: meta.title,
      description: meta.description,
      categoryTitle: getCategory(meta.category).title,
      headings: extractHeadings(article.body).map((h) => h.text),
      text: toPlainText(article.body),
    };
  });
}
