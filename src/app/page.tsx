import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPlanCatalog } from "@/lib/stripe";
import { LandingScene } from "@/components/landing/scene";
import { HeroReviewDemo } from "@/components/landing/hero-review-demo";
import { LoopStrip } from "@/components/landing/loop-strip";
import { WildDemo } from "@/components/landing/wild-demo";
import { MobileNav } from "@/components/landing/mobile-nav";
import { FinalCtaCheck } from "@/components/landing/final-cta-check";
import { Reveal } from "@/components/landing/reveal";

export const metadata = {
  title: "KanjiKatch — Learn the Japanese you've seen",
  description:
    "Snap a photo of the Japanese you're reading. KanjiKatch builds your deck, schedules review, and generates fresh sentences from the words you've caught.",
};

// Prices come from the same catalog the pricing page checks out against —
// no number is hardcoded in the landing JSX. Catalog entries are null until
// their Stripe env vars are set, so fall back to the canonical amounts.
function getPrices() {
  const catalog = getPlanCatalog();
  const monthly = catalog.pro_monthly?.amountUsd ?? 10;
  const annual = catalog.pro_annual?.amountUsd ?? 100;
  const founderMonthly = catalog.pro_founder_monthly?.amountUsd ?? 7;
  const founderAnnual = catalog.pro_founder_annual?.amountUsd ?? 70;
  const savePct = Math.round((1 - annual / (monthly * 12)) * 100);
  return { monthly, annual, founderMonthly, founderAnnual, savePct };
}

export default async function HomePage() {
  const { userId } = await auth();
  const ctaHref = userId ? "/dashboard" : "/sign-up";
  const ctaLabel = userId ? "Open dashboard" : "Catch your first page";
  const prices = getPrices();

  const faqItems = [
    {
      q: "Do I have to type readings and meanings?",
      a: "Never. Handwritten notes, a textbook spread, a news screenshot, a manga panel — if it has Japanese on it, KanjiKatch pulls every kanji, word, and sentence with readings and meanings filled in. Rough handwriting included. Edit anything that's not quite right in one tap.",
    },
    {
      q: "How does it compete with WaniKani or Anki?",
      a: "It doesn't try to. WaniKani is a great curriculum if you want one chosen for you. Anki is a great empty deck. KanjiKatch is the one that matches the page you're reading right now — and keeps generating new reading from the words you've already learned.",
    },
    {
      q: "What level do I need to be?",
      a: "Anywhere from your first kanji to N1. KanjiKatch doesn't pick a curriculum for you — your materials do. Beginners get the most out of textbook pages; advanced learners feed in novels, news articles, and screenshots from anything they're already reading.",
    },
    {
      q: "What does it cost?",
      a: `Free is $0 forever: 10 extractions to start plus 5 a month, with unlimited reviews and lookups. Pro is $${prices.monthly}/mo or $${prices.annual}/yr (save ${prices.savePct}%): unlimited extractions for personal study (fair use), audio on all sentences, images retained and re-extractable, and session recap emails. 7-day trial, card required, cancel anytime. First 100 subscribers lock in $${prices.founderMonthly}/mo or $${prices.founderAnnual}/yr.`,
    },
    {
      q: "What happens if I cancel?",
      a: "Cards, review history, and any audio you've generated stay forever. Pro features stop applying to new captures from the day you cancel.",
    },
  ];

  const jsonLd = {
    softwareApp: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "KanjiKatch",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      description: metadata.description,
      offers: [
        { "@type": "Offer", price: "0", priceCurrency: "USD" },
        { "@type": "Offer", price: String(prices.monthly), priceCurrency: "USD" },
      ],
    },
    faq: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd.softwareApp) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd.faq) }}
      />
      <Header userId={userId} />
      <Hero ctaHref={ctaHref} ctaLabel={ctaLabel} />
      <TheLoop />
      <Wild ctaHref={ctaHref} />
      <div className="floor-divider max-w-xs mx-auto" aria-hidden />
      <Stance prices={prices} />
      <div className="floor-divider max-w-xs mx-auto" aria-hidden />
      <FAQ items={faqItems} />
      <FinalCTA ctaHref={ctaHref} ctaLabel={ctaLabel} />
      <Footer />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Header                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function Header({ userId }: { userId: string | null }) {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border/60">
      <div className="relative container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-baseline gap-2.5 group">
          <span className="font-serif text-2xl text-primary leading-none">漢字</span>
          <span className="font-display text-xl font-semibold tracking-tight">
            KanjiKatch
          </span>
          <span className="hidden sm:inline text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70 ml-1">
            キャッチ
          </span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-3">
          {[
            ["#how", "How it works"],
            ["#wild", "In the wild"],
            ["/pricing", "Pricing"],
            ["#faq", "FAQ"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="hidden md:inline text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
            >
              {label}
            </Link>
          ))}
          {userId ? (
            <Button asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild className="hidden md:inline-flex">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild className="hidden md:inline-flex">
                <Link href="/sign-up">Get started</Link>
              </Button>
            </>
          )}
          <MobileNav signedIn={!!userId} />
        </div>
      </div>
    </header>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Hero — washi above, the day scene below, a playable review card between   */
/* ────────────────────────────────────────────────────────────────────────── */

function Hero({ ctaHref, ctaLabel }: { ctaHref: string; ctaLabel: string }) {
  return (
    <section className="relative overflow-hidden min-h-[740px] lg:min-h-[85vh]">
      {/* The woodblock hard edge: no gradient, no fade — the crisp line
          between washi and sky is the page's signature. */}
      <LandingScene
        palette="day"
        className="absolute inset-x-0 bottom-0 h-[30%] min-h-[200px] lg:h-[34%]"
      />
      <div className="relative container mx-auto px-4 sm:px-6 pt-14 lg:pt-20 lg:grid lg:grid-cols-12 lg:gap-8 items-start">
        <div className="lg:col-span-6">
          <p className="stagger-0 text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Snap notes. Learn kanji.
          </p>
          <h1 className="stagger-1 mt-4 font-display text-5xl sm:text-6xl 2xl:text-7xl font-bold leading-[1.05] tracking-tight">
            Learn the Japanese
            <br />
            you&apos;ve{" "}
            <span className="relative inline-block">
              <span className="relative z-10">seen.</span>
              <span
                aria-hidden
                className="hero-gold-wipe absolute inset-x-0 bottom-[0.05em] h-[0.45em]"
                style={{ background: "hsl(45 100% 72% / 0.55)" }}
              />
            </span>
          </h1>
          <p className="stagger-2 mt-5 text-lg text-muted-foreground max-w-[38ch]">
            Three minutes. One photo. A library that grows from what you
            actually read.
          </p>
          <div className="stagger-4 mt-8 flex items-center gap-5">
            <Link
              href={ctaHref}
              className="start-review-cta [animation:none] active:scale-[0.99] group"
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="#how"
              className="text-base font-medium text-primary underline-offset-4 hover:underline"
            >
              Show me.
            </Link>
          </div>
          <p className="stagger-5 mt-6 text-sm text-muted-foreground">
            Your handwriting works. So does printed text, a screenshot, a manga
            panel.
          </p>
        </div>

        <div className="lg:col-span-6 mt-12 lg:mt-8">
          <div className="stagger-5 max-w-[360px] sm:max-w-[400px] mx-auto lg:ml-auto lg:mr-0">
            <HeroReviewDemo ctaHref={ctaHref} ctaLabel={ctaLabel} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  The Loop — #how                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

function TheLoop() {
  return (
    <section id="how" className="scroll-mt-24">
      <div className="container mx-auto px-4 sm:px-6 py-24 md:py-32">
        <Reveal className="max-w-2xl mx-auto text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            The loop
          </p>
          <h2 className="mt-4 font-display text-4xl sm:text-5xl font-bold tracking-tight">
            Snap notes. Learn kanji.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-[52ch] mx-auto">
            No importing CSVs. No copying readings off Jisho.
          </p>
        </Reveal>
        <LoopStrip />
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  In the Wild — #wild                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function Wild({ ctaHref }: { ctaHref: string }) {
  return (
    <section id="wild" className="scroll-mt-24">
      <div className="container mx-auto px-4 sm:px-6 py-24 md:py-32 lg:grid lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-5 lg:sticky lg:top-28 self-start">
          <Reveal>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              In the wild
            </p>
            <h2 className="mt-4 font-display text-4xl sm:text-5xl font-bold tracking-tight">
              Now — read them in the wild.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Built five minutes ago from words you just caught. Every session,
              fresh ones — calibrated to your library.
            </p>
            <p className="mt-4 text-muted-foreground">
              Studied words glow gold; partials get a teal underline. Tap an
              unfamiliar word and it becomes tomorrow&apos;s catch.
            </p>
          </Reveal>
        </div>
        <div className="lg:col-span-7 mt-10 lg:mt-0">
          <Reveal delay={0.1}>
            <WildDemo ctaHref={ctaHref} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  The Stance — positioning ledger + pricing strip                           */
/* ────────────────────────────────────────────────────────────────────────── */

interface Prices {
  monthly: number;
  annual: number;
  founderMonthly: number;
  founderAnnual: number;
  savePct: number;
}

function Stance({ prices }: { prices: Prices }) {
  const rows: Array<[string, string | null, string | null, string]> = [
    ["Deck shaped by your materials", null, null, "Built from photos of what you read"],
    ["Readings & meanings filled in", null, "Fixed list", "Auto, editable"],
    ["Real sentences with your words", null, "Fixed examples", "Generated each session"],
    ["Spaced repetition", "Yes", "Yes", "Yes"],
    ["Setup time", "Hours", "Pre-set", "One photo"],
  ];

  return (
    <section>
      <div className="container mx-auto px-4 sm:px-6 py-24 md:py-32 max-w-4xl text-center">
        <Reveal>
          <h2 className="font-display text-4xl sm:text-5xl font-bold leading-tight tracking-tight max-w-[24ch] mx-auto">
            Anki is a blank deck. WaniKani is a fixed curriculum.{" "}
            <span className="text-primary">KanjiKatch is yours.</span>
          </h2>
        </Reveal>

        {/* The ledger — hairlines, no box. "Yes / Yes / Yes" stays plain:
            honesty is the joke. */}
        <Reveal delay={0.1} className="mt-12 overflow-x-auto -mx-4 px-4">
          <div className="max-w-2xl mx-auto min-w-[560px] text-left text-sm">
            <div className="grid grid-cols-[1.3fr_0.7fr_0.9fr_1.3fr] gap-x-4 border-b border-border pb-2">
              <span />
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground text-center">
                Anki
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground text-center">
                WaniKani
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary text-center">
                KanjiKatch
              </span>
            </div>
            {rows.map(([label, anki, wk, kk]) => (
              <div
                key={label}
                className="grid grid-cols-[1.3fr_0.7fr_0.9fr_1.3fr] gap-x-4 items-baseline border-b border-border py-3"
              >
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground text-center">{anki ?? "—"}</span>
                <span className="text-muted-foreground text-center">{wk ?? "—"}</span>
                <span className="font-medium text-center">{kk}</span>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Pricing strip — full table lives at /pricing */}
        <Reveal delay={0.1} className="mt-16">
          <p className="font-display text-2xl font-medium">
            Free for the habit. Pro for everything that follows.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4 max-w-[280px] sm:max-w-none mx-auto">
            <div className="stat-stamp hover:-translate-y-0.5 sm:w-64">
              <p className="font-mono tabular-nums text-3xl font-bold">$0</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">
                Free · forever
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                10 extractions to start + 5/month. Unlimited reviews and
                lookups.
              </p>
            </div>
            <div className="stat-stamp hover:-translate-y-0.5 sm:w-64">
              <p className="font-mono tabular-nums text-3xl font-bold">
                ${prices.monthly}
                <span className="text-base font-medium text-muted-foreground">/mo</span>
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">
                Pro
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                or ${prices.annual}/yr (save {prices.savePct}%). Unlimited
                extractions for personal study (fair use).
              </p>
              <p className="mt-2 text-sm italic text-muted-foreground">
                Pro makes every session like this.
              </p>
            </div>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            First 100 subscribers: ${prices.founderMonthly}/mo or $
            {prices.founderAnnual}/yr, locked in.
          </p>
          <Link
            href="/pricing"
            className="group mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary"
          >
            See pricing
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  FAQ — #faq                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

const FAQ_ACCENTS = [
  "open:border-l-orange-200",
  "open:border-l-amber-200",
  "open:border-l-emerald-200",
  "open:border-l-indigo-200",
  "open:border-l-orange-200",
];

function FAQ({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <section id="faq" className="scroll-mt-24">
      <div className="container mx-auto px-4 sm:px-6 py-24 md:py-32 max-w-2xl">
        <Reveal>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Questions
          </p>
          <h2 className="mt-4 font-display text-4xl font-bold tracking-tight">
            Honest answers.
          </h2>
        </Reveal>
        <Reveal delay={0.1} className="mt-10">
          {items.map((item, i) => (
            <details
              key={item.q}
              name="faq"
              className={`group border-b border-border border-l-transparent open:border-l-[3px] open:pl-4 transition-[padding] duration-200 ${FAQ_ACCENTS[i]}`}
            >
              <summary className="flex items-start justify-between gap-6 py-5 font-medium cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="font-display text-lg font-semibold">{item.q}</span>
                <span
                  aria-hidden
                  className="font-mono text-xl text-muted-foreground transition-transform duration-200 group-open:rotate-45 leading-none mt-0.5"
                >
                  +
                </span>
              </summary>
              <p className="pb-5 text-muted-foreground leading-relaxed group-open:animate-[fade-up-in_0.25s_ease-out]">
                {item.a}
              </p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Final CTA — the same scene at golden hour                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function FinalCTA({ ctaHref, ctaLabel }: { ctaHref: string; ctaLabel: string }) {
  return (
    <section className="relative overflow-hidden min-h-[80svh] flex items-center py-28 md:py-36">
      <LandingScene palette="dusk" showStars className="absolute inset-0" />
      <div className="relative z-10 container mx-auto px-4 sm:px-6">
        <div className="max-w-xl mx-auto text-center pb-40">
          <FinalCtaCheck />
          <Reveal delay={0.12}>
            <h2 className="mt-8 font-display text-5xl sm:text-6xl font-bold tracking-tight text-[#F5F0E6]">
              The first one&apos;s on us.
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-4 text-[#F5F0E6]/80">
              7-day trial, card required, cancel anytime.
            </p>
          </Reveal>
          <Reveal delay={0.28}>
            <div className="mt-8 flex justify-center">
              <Link
                href={ctaHref}
                className="start-review-cta active:scale-[0.99] group w-full max-w-xs sm:w-auto"
              >
                {ctaLabel}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Footer                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="container mx-auto px-4 sm:px-6 py-12 flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-3">
          <span className="font-serif text-xl text-primary leading-none">漢字</span>
          <span className="font-display font-semibold">KanjiKatch</span>
          {/* The 1号車 badge, one more time — same object, third light. */}
          <svg
            viewBox="0 0 52 32"
            className="w-[34px] h-[21px]"
            aria-hidden
            shapeRendering="crispEdges"
          >
            <rect width="52" height="32" rx="2" fill="#2D6A4F" />
            <text
              x="26"
              y="21"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="14"
              fontFamily="system-ui, sans-serif"
              fontWeight="600"
            >
              1号車
            </text>
          </svg>
          <span className="font-mono text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} KanjiKatch
          </span>
        </div>
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground"
        >
          <Link href="/pricing" className="hover:text-foreground transition-colors">
            Pricing
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <a
            href="mailto:support@kanjikatch.com"
            className="hover:text-foreground transition-colors"
          >
            support@kanjikatch.com
          </a>
        </nav>
      </div>
    </footer>
  );
}
