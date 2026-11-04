import { describe, expect, it } from "vitest";
import { buildSearchIndex, extractHeadings, HELP_ARTICLES, getArticle, slugifyHeading } from "./help-center";
import { highlightParts, makeSnippet, searchHelp, tokenize } from "./help-search";

const index = buildSearchIndex();

describe("help center content", () => {
  it("has a Markdown body for every registered article", () => {
    for (const meta of HELP_ARTICLES) {
      expect(getArticle(meta.slug)?.body.length).toBeGreaterThan(100);
    }
  });

  it("only links related articles that exist", () => {
    const slugs = new Set(HELP_ARTICLES.map((a) => a.slug));
    for (const meta of HELP_ARTICLES) {
      for (const related of meta.related) expect(slugs.has(related)).toBe(true);
    }
  });

  it("only links to help articles that exist", () => {
    const slugs = new Set(HELP_ARTICLES.map((a) => a.slug));
    for (const meta of HELP_ARTICLES) {
      const body = getArticle(meta.slug)!.body;
      for (const [, slug] of body.matchAll(/\]\(\/help\/([^)#]+)/g)) {
        expect(slugs.has(slug)).toBe(true);
      }
    }
  });

  it("extracts H2 headings with stable anchor ids", () => {
    const headings = extractHeadings("intro\n## Start a **review** session\n### Not this\n## Undo a grade\n");
    expect(headings).toEqual([
      { id: "start-a-review-session", text: "Start a review session" },
      { id: "undo-a-grade", text: "Undo a grade" },
    ]);
    expect(slugifyHeading("Free vs Pro: plans, limits")).toBe("free-vs-pro-plans-limits");
  });
});

describe("searchHelp", () => {
  it("returns nothing for an empty query", () => {
    expect(searchHelp(index, "   ")).toEqual([]);
  });

  it("ranks the matching article first", () => {
    expect(searchHelp(index, "cancel")[0].entry.slug).toBe("plans-and-billing");
    expect(searchHelp(index, "streak")[0].entry.slug).toBe("streaks-and-progress");
    expect(searchHelp(index, "study guide")[0].entry.slug).toBe("study-guides");
  });

  it("matches at word starts, not inside words", () => {
    const tiny = [{ slug: "a", title: "Approve", description: "", categoryTitle: "", headings: [], text: "approve" }];
    expect(searchHelp(tiny, "pro")).toEqual([]);
    expect(searchHelp(tiny, "appr")).toHaveLength(1);
  });

  it("requires every term to match", () => {
    expect(searchHelp(index, "streak zzzqqq")).toEqual([]);
  });

  it("builds a snippet around the match", () => {
    const snippet = makeSnippet("a ".repeat(100) + "needle here", ["needle"]);
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet).toContain("needle");
  });
});

describe("tokenize and highlightParts", () => {
  it("splits on whitespace and punctuation", () => {
    expect(tokenize("How do I, delete?")).toEqual(["how", "do", "i", "delete"]);
  });

  it("marks matched parts case-insensitively", () => {
    expect(highlightParts("Delete a Card", ["card"])).toEqual([
      { text: "Delete a ", match: false },
      { text: "Card", match: true },
    ]);
    expect(highlightParts("approve pro", ["pro"]).filter((p) => p.match)).toEqual([{ text: "pro", match: true }]);
  });
});
