import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, Camera, CreditCard, GraduationCap, ShieldCheck, type LucideIcon } from "lucide-react";
import {
  buildSearchIndex,
  getArticleMeta,
  getArticlesInCategory,
  HELP_CATEGORIES,
  HELP_SUPPORT_EMAIL,
  POPULAR_ARTICLE_SLUGS,
  type HelpCategoryId,
} from "@/lib/help-center";
import { HelpSearch } from "@/components/help/help-search";
import { ContactSupport } from "@/components/help/contact-support";

export const metadata: Metadata = {
  title: "Help Center — KanjiKatch",
  description: "Guides and answers for capturing, reviewing, and studying Japanese with KanjiKatch.",
};

const CATEGORY_ICONS: Record<HelpCategoryId, LucideIcon> = {
  "getting-started": Camera,
  reviewing: GraduationCap,
  library: BookOpen,
  billing: CreditCard,
  account: ShieldCheck,
};

const QUICK_LINKS = [
  { slug: "capturing-japanese", label: "Capturing a page" },
  { slug: "how-reviews-work", label: "How reviews work" },
  { slug: "set-aside-fix-delete-cards", label: "Deleting a card" },
  { slug: "plans-and-billing", label: "Cancelling Pro" },
];

export default function HelpHomePage() {
  const index = buildSearchIndex();
  const popular = POPULAR_ARTICLE_SLUGS.map((slug) => getArticleMeta(slug)!);

  return (
    <main>
      <section className="border-b border-border/60 bg-muted/40">
        <div className="container mx-auto px-4 sm:px-6 py-14 sm:py-20 max-w-3xl text-center">
          <p className="font-serif text-primary text-sm tracking-[0.2em]">ヘルプセンター</p>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl font-bold tracking-tight">How can we help?</h1>
          <p className="mt-3 text-muted-foreground">
            Step-by-step guides for capturing, reviewing, and getting the most out of KanjiKatch.
          </p>
          <div className="mt-8">
            <HelpSearch index={index} supportEmail={HELP_SUPPORT_EMAIL} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-muted-foreground">Popular:</span>
            {QUICK_LINKS.map((q) => (
              <Link
                key={q.slug}
                href={`/help/${q.slug}`}
                className="rounded-full border bg-background px-3 py-1 hover:border-primary/40 hover:text-primary transition-colors"
              >
                {q.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 sm:px-6 py-12 max-w-5xl space-y-14">
        <section aria-labelledby="topics-heading">
          <h2 id="topics-heading" className="font-display text-2xl font-semibold tracking-tight">
            Browse by topic
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {HELP_CATEGORIES.map((category) => {
              const Icon = CATEGORY_ICONS[category.id];
              const articles = getArticlesInCategory(category.id);
              return (
                <section
                  key={category.id}
                  id={category.id}
                  aria-labelledby={`${category.id}-heading`}
                  className="scroll-mt-24 rounded-xl border bg-background p-5 flex flex-col"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 id={`${category.id}-heading`} className="mt-4 font-semibold text-lg">
                    {category.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {articles.map((a) => (
                      <li key={a.slug}>
                        <Link href={`/help/${a.slug}`} className="text-foreground/90 hover:text-primary hover:underline underline-offset-2">
                          {a.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-auto pt-4 text-xs text-muted-foreground">
                    {articles.length} {articles.length === 1 ? "article" : "articles"}
                  </p>
                </section>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="popular-heading">
          <h2 id="popular-heading" className="font-display text-2xl font-semibold tracking-tight">
            Popular articles
          </h2>
          <ul className="mt-6 divide-y rounded-xl border">
            {popular.map((a) => (
              <li key={a.slug}>
                <Link href={`/help/${a.slug}`} className="group flex items-center gap-4 px-5 py-4 hover:bg-muted/40">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium group-hover:text-primary">{a.title}</span>
                    <span className="block text-sm text-muted-foreground">{a.description}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <ContactSupport email={HELP_SUPPORT_EMAIL} />
      </div>
    </main>
  );
}
