import type { HelpSearchEntry } from "@/lib/help-center";

// Client-side help center search. Small enough to ship the whole index to
// the browser: every query term must appear somewhere in the article, and
// matches in the title outrank headings, which outrank the description,
// which outrank the body.

export interface HelpSearchResult {
  entry: HelpSearchEntry;
  score: number;
  snippet: string;
}

const WEIGHTS = { title: 10, heading: 5, description: 3, text: 1 };
const SNIPPET_RADIUS = 70;

export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,.;:!?"'()]+/)
    .filter((t) => t.length > 0);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Terms match at the start of a word, so "pro" finds "Pro" and "progress"
// but not "approve". A whole-word hit is worth double a prefix hit.
function scoreOccurrences(haystack: string, term: string): number {
  const re = new RegExp(`(?:^|[^a-z0-9])(${escapeRegExp(term)})([a-z0-9]?)`, "g");
  let score = 0;
  for (const m of haystack.matchAll(re)) score += m[2] ? 1 : 2;
  return score;
}

/** A short excerpt of the body around the first matching term. */
export function makeSnippet(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  const hits = terms
    .map((t) => lower.search(new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(t)}`)))
    .map((i) => (i > 0 ? i + 1 : i))
    .filter((i) => i >= 0);
  if (hits.length === 0) {
    return text.length > SNIPPET_RADIUS * 2 ? `${text.slice(0, SNIPPET_RADIUS * 2).trim()}…` : text;
  }
  const at = Math.min(...hits);
  const start = Math.max(0, at - SNIPPET_RADIUS);
  const end = Math.min(text.length, at + SNIPPET_RADIUS);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export function searchHelp(index: HelpSearchEntry[], query: string, limit = 8): HelpSearchResult[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const results: HelpSearchResult[] = [];
  for (const entry of index) {
    const title = entry.title.toLowerCase();
    const description = entry.description.toLowerCase();
    const headings = entry.headings.join(" \n ").toLowerCase();
    const text = entry.text.toLowerCase();

    let score = 0;
    let allTermsFound = true;
    for (const term of terms) {
      const inTitle = scoreOccurrences(title, term);
      const inHeadings = scoreOccurrences(headings, term);
      const inDescription = scoreOccurrences(description, term);
      const inText = scoreOccurrences(text, term);
      if (inTitle + inHeadings + inDescription + inText === 0) {
        allTermsFound = false;
        break;
      }
      score +=
        inTitle * WEIGHTS.title +
        inHeadings * WEIGHTS.heading +
        inDescription * WEIGHTS.description +
        Math.min(inText, 5) * WEIGHTS.text;
    }
    if (!allTermsFound) continue;

    // Reward the whole phrase appearing together.
    if (terms.length > 1) {
      const phrase = terms.join(" ");
      if (title.includes(phrase)) score += WEIGHTS.title * 2;
      else if (text.includes(phrase)) score += WEIGHTS.heading;
    }

    results.push({ entry, score, snippet: makeSnippet(entry.text, terms) });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Split text into plain and matched parts, for highlighting in results. */
export function highlightParts(text: string, terms: string[]): { text: string; match: boolean }[] {
  const usable = terms.filter((t) => t.length > 0);
  if (usable.length === 0) return [{ text, match: false }];
  // Same word-start rule as matching: only highlight where a term begins a word.
  const pattern = new RegExp(`(?<![A-Za-z0-9])(${usable.map(escapeRegExp).join("|")})`, "gi");
  return text
    .split(pattern)
    .filter((part) => part.length > 0)
    .map((part, i, parts) => ({
      text: part,
      match:
        usable.includes(part.toLowerCase()) &&
        (i === 0 || !/[A-Za-z0-9]$/.test(parts[i - 1])),
    }));
}
