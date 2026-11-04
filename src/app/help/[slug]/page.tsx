import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronRight, FileText } from "lucide-react";
import {
  buildSearchIndex,
  extractHeadings,
  getArticle,
  getArticleMeta,
  getArticlesInCategory,
  getCategory,
  HELP_ARTICLES,
  HELP_LAST_UPDATED,
  HELP_SUPPORT_EMAIL,
} from "@/lib/help-center";
import { HelpMarkdown } from "@/components/help/help-markdown";
import { HelpSearch } from "@/components/help/help-search";
import { ArticleFeedback } from "@/components/help/article-feedback";
import { ContactSupport } from "@/components/help/contact-support";
import { cn } from "@/lib/utils";

export const dynamicParams = false;

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const meta = getArticleMeta(slug);
  if (!meta) return {};
  return {
    title: `${meta.title} — KanjiKatch Help Center`,
    description: meta.description,
  };
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const category = getCategory(article.category);
  const headings = extractHeadings(article.body);
  const siblings = getArticlesInCategory(article.category);
  const related = article.related.map((s) => getArticleMeta(s)!).filter(Boolean);

  return (
    <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-10 max-w-6xl">
      <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
          <Link href="/help" className="hover:text-foreground shrink-0">
            Help Center
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <Link href={`/help#${category.id}`} className="hover:text-foreground truncate">
            {category.title}
          </Link>
        </nav>
        <div className="sm:w-72">
          <HelpSearch index={buildSearchIndex()} size="sm" supportEmail={HELP_SUPPORT_EMAIL} />
        </div>
      </div>

      <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-12">
        <article className="min-w-0 max-w-3xl">
          <header className="border-b pb-6">
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">{article.title}</h1>
            <p className="mt-3 text-lg text-muted-foreground">{article.description}</p>
            <p className="mt-4 text-xs text-muted-foreground">Updated {HELP_LAST_UPDATED}</p>
          </header>

          {headings.length > 2 && (
            <details className="lg:hidden mt-6 rounded-lg border px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium">In this article</summary>
              <ul className="mt-3 space-y-2">
                {headings.map((h) => (
                  <li key={h.id}>
                    <a href={`#${h.id}`} className="text-muted-foreground hover:text-primary">
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="mt-2">
            <HelpMarkdown content={article.body} />
          </div>

          <div className="mt-12 space-y-8">
            <ArticleFeedback slug={article.slug} supportEmail={HELP_SUPPORT_EMAIL} />

            {related.length > 0 && (
              <section aria-labelledby="related-heading">
                <h2 id="related-heading" className="font-display text-xl font-semibold tracking-tight">
                  Related articles
                </h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {related.map((r) => (
                    <li key={r.slug}>
                      <Link
                        href={`/help/${r.slug}`}
                        className="flex h-full gap-3 rounded-lg border p-4 hover:border-primary/40 hover:bg-muted/30 transition-colors"
                      >
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                        <span>
                          <span className="block text-sm font-semibold">{r.title}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{r.description}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <ContactSupport email={HELP_SUPPORT_EMAIL} articleTitle={article.title} />
          </div>
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-8 text-sm">
            {headings.length > 0 && (
              <nav aria-labelledby="toc-heading">
                <h2 id="toc-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  In this article
                </h2>
                <ul className="mt-3 space-y-2 border-l">
                  {headings.map((h) => (
                    <li key={h.id}>
                      <a
                        href={`#${h.id}`}
                        className="-ml-px block border-l border-transparent pl-3 text-muted-foreground hover:border-primary hover:text-foreground"
                      >
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            <nav aria-labelledby="section-heading">
              <h2 id="section-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {category.title}
              </h2>
              <ul className="mt-3 space-y-2">
                {siblings.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/help/${s.slug}`}
                      aria-current={s.slug === article.slug ? "page" : undefined}
                      className={cn(
                        "block hover:text-primary",
                        s.slug === article.slug ? "font-semibold text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {s.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>
      </div>
    </main>
  );
}
