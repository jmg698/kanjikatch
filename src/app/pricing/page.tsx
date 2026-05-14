import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { ArrowRight, Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { getPlanCatalog } from "@/lib/stripe";
import { PricingActions } from "./pricing-actions";

export const metadata = {
  title: "Pricing — KanjiKatch",
  description: "Free forever for the daily habit. Pro for unlimited extractions, audio, and personalized sentences.",
};

const FEATURE_ROWS: Array<{
  label: string;
  detail?: string;
  free: string | true | false;
  pro: string | true | false;
}> = [
  {
    label: "Extractions",
    detail: "Photos or text → kanji, vocab, and sentences pulled from the page.",
    free: "10 to start, then 5/month",
    pro: "Unlimited (fair use)",
  },
  {
    label: "Reviews and lookups",
    free: true,
    pro: true,
  },
  {
    label: "Mid-session preview",
    detail: "Personalized sentence at card 25.",
    free: "1 sentence, no audio",
    pro: "2 sentences with audio",
  },
  {
    label: "Post-session sentences",
    free: "2 from shared library",
    pro: "3–5 personalized, with audio",
  },
  {
    label: "Audio on every sentence",
    free: false,
    pro: true,
  },
  {
    label: "Session recap email",
    detail: "Sentences from today's session, delivered to your inbox.",
    free: false,
    pro: true,
  },
  {
    label: "Image retention",
    free: "Deleted after extraction",
    pro: "Kept, re-extractable",
  },
  {
    label: "Cancel anytime",
    detail: "Cards, history, and audio you've already generated stay forever.",
    free: true,
    pro: true,
  },
];

export default async function PricingPage() {
  const { userId } = await auth();
  const catalog = getPlanCatalog();

  // Read tier so the CTA can switch between "Start free trial" and
  // "Manage subscription" once the user is already paid.
  let currentTier: string | null = null;
  if (userId) {
    const [row] = await db
      .select({ subscriptionTier: users.subscriptionTier })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    currentTier = row?.subscriptionTier ?? "free";
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border/60">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-baseline gap-2.5 group">
            <span className="font-serif text-2xl text-primary leading-none">漢字</span>
            <span className="font-display text-xl font-semibold tracking-tight">KanjiKatch</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-3">
            <Link
              href="/#how"
              className="hidden md:inline text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
            >
              How it works
            </Link>
            <Link
              href="/#wild"
              className="hidden md:inline text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
            >
              In the wild
            </Link>
            {userId ? (
              <Button asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link href="/sign-up">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="container mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-10 max-w-5xl">
        <p className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-[hsl(38_70%_38%)]">
          <span className="inline-block w-6 h-px bg-[hsl(38_70%_38%)]/60" />
          Pricing
        </p>
        <h1 className="mt-5 font-display text-4xl sm:text-5xl font-bold leading-tight tracking-tight">
          Free for the habit. Pro for everything that follows.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground max-w-2xl">
          The review loop is free forever — capture a page, drill the cards, build
          a streak. Pro is for when you want personalized sentences with audio,
          unlimited captures, and a recap of every session in your inbox.
        </p>
      </section>

      <section className="container mx-auto px-4 sm:px-6 pb-10 max-w-5xl">
        <div className="grid gap-6 md:grid-cols-2">
          <PlanCard
            title="Free"
            blurb="Everything you need for a daily Japanese review habit."
            price={<><span className="font-display text-5xl font-bold">$0</span></>}
            interval=""
            cta={
              userId ? (
                <Button variant="outline" asChild className="w-full">
                  <Link href="/dashboard">Open dashboard</Link>
                </Button>
              ) : (
                <Button variant="outline" asChild className="w-full">
                  <Link href="/sign-up">Start free</Link>
                </Button>
              )
            }
            highlights={[
              "10 starter + 5 extractions per month",
              "Unlimited review",
              "Sample personalized sentence each session",
            ]}
          />

          <PlanCard
            title="Pro"
            blurb="Unlimited captures, audio, and a session recap in your inbox."
            featured
            price={<PricePresentation />}
            interval=""
            cta={
              <PricingActions
                userId={userId}
                currentTier={currentTier}
                catalog={catalog}
              />
            }
            highlights={[
              "Unlimited extractions (fair use)",
              "3–5 personalized sentences per session",
              "Audio on every sentence",
              "Session recap email",
              "7-day free trial",
            ]}
          />
        </div>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          Founder pricing — $7/mo or $70/yr — locks in for the first 100 paid
          subscribers while their subscription stays active.
        </p>
      </section>

      <section className="container mx-auto px-4 sm:px-6 py-10 max-w-5xl">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          What&apos;s in each plan
        </h2>
        <div className="mt-6 overflow-hidden border border-border/60 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Feature</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Free</th>
                <th className="text-left px-4 py-3 font-medium text-foreground">Pro</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row, i) => (
                <tr key={row.label} className={i === FEATURE_ROWS.length - 1 ? "" : "border-b border-border/40"}>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium">{row.label}</div>
                    {row.detail && (
                      <div className="text-xs text-muted-foreground mt-0.5">{row.detail}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-muted-foreground">
                    <FeatureCell value={row.free} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <FeatureCell value={row.pro} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6 pb-20 max-w-5xl">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          The fine print
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 text-sm text-muted-foreground leading-relaxed">
          <div>
            <p className="font-medium text-foreground">Cancel anytime.</p>
            <p className="mt-1">
              Cards, review history, and any audio you&apos;ve generated stay forever.
              Pro features stop on new captures from the day you cancel.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Trial requires a card.</p>
            <p className="mt-1">
              7 days, full Pro features. Cancel before day 7 and you&apos;re not
              charged. We&apos;ll send a reminder on day 6.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Fair-use cap on Pro.</p>
            <p className="mt-1">
              &ldquo;Unlimited&rdquo; means personal study, not an automation budget. We&apos;ll
              reach out before flagging legitimate usage.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Questions?</p>
            <p className="mt-1">
              Email <Link className="underline" href="mailto:support@kanjikatch.com">support@kanjikatch.com</Link>.
              We answer.
            </p>
          </div>
        </div>
        <div className="mt-12 flex justify-center">
          <Button size="lg" asChild>
            <Link href={userId ? "/dashboard" : "/sign-up"}>
              {userId ? "Open dashboard" : "Start free"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function PlanCard({
  title,
  blurb,
  price,
  interval,
  cta,
  highlights,
  featured = false,
}: {
  title: string;
  blurb: string;
  price: React.ReactNode;
  interval: string;
  cta: React.ReactNode;
  highlights: string[];
  featured?: boolean;
}) {
  return (
    <div
      className={
        "relative rounded-2xl border p-6 sm:p-8 flex flex-col gap-5 " +
        (featured
          ? "border-primary/40 bg-primary/[0.03] shadow-sm"
          : "border-border/60 bg-card/50")
      }
    >
      {featured && (
        <span className="absolute -top-3 left-6 text-[10px] font-mono uppercase tracking-[0.22em] bg-primary text-primary-foreground px-2 py-1 rounded">
          Pro
        </span>
      )}
      <div>
        <h3 className="font-display text-2xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{blurb}</p>
      </div>
      <div className="flex items-baseline gap-1">
        {price}
        {interval && <span className="text-sm text-muted-foreground">{interval}</span>}
      </div>
      <ul className="space-y-2 text-sm">
        {highlights.map((h) => (
          <li key={h} className="flex items-start gap-2">
            <Check className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
            <span>{h}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-2">{cta}</div>
    </div>
  );
}

function FeatureCell({ value }: { value: string | boolean }) {
  if (value === true) {
    return <Check className="h-4 w-4 text-primary" />;
  }
  if (value === false) {
    return <Minus className="h-4 w-4 text-muted-foreground/60" />;
  }
  return <span>{value}</span>;
}

function PricePresentation() {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-1">
        <span className="font-display text-5xl font-bold">$10</span>
        <span className="text-sm text-muted-foreground">/month</span>
      </div>
      <div className="text-sm text-muted-foreground">or $100/year — save 17%</div>
    </div>
  );
}
