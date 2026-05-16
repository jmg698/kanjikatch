import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, Sparkles, ArrowRight } from "lucide-react";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import { ensureUserRow } from "@/lib/ensure-user";
import { readPlanQuota } from "@/lib/plan-limits";
import { BillingActions } from "./billing-actions";

export const metadata = {
  title: "Billing — KanjiKatch",
};

function formatDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function describeStatus(status: string | null | undefined, cancelAtPeriodEnd: boolean): string {
  if (!status) return "No active subscription";
  if (cancelAtPeriodEnd && (status === "active" || status === "trialing")) {
    return "Active — cancels at period end";
  }
  switch (status) {
    case "active":
      return "Active";
    case "trialing":
      return "Free trial";
    case "past_due":
      return "Payment past due";
    case "canceled":
      return "Canceled";
    case "incomplete":
      return "Incomplete";
    case "incomplete_expired":
      return "Incomplete (expired)";
    case "unpaid":
      return "Unpaid";
    case "paused":
      return "Paused";
    default:
      return status;
  }
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<{ billing?: string }>;
}) {
  const userId = await getCurrentUserId();

  // Self-heal in case the Clerk user.created webhook hasn't landed yet —
  // otherwise a fresh signup would never be able to view their plan or
  // start a checkout.
  await ensureUserRow(userId);

  const [maybeRow] = await db
    .select({
      subscriptionTier: users.subscriptionTier,
      subscriptionStatus: users.subscriptionStatus,
      stripeCustomerId: users.stripeCustomerId,
      currentPeriodEnd: users.currentPeriodEnd,
      trialEnd: users.trialEnd,
      cancelAtPeriodEnd: users.cancelAtPeriodEnd,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // ensureUserRow() above means maybeRow is virtually always defined; the
  // fallback is belt-and-suspenders so a transient DB hiccup still renders
  // a sensible free-tier view rather than crashing the page.
  const row = maybeRow ?? {
    subscriptionTier: "free" as const,
    subscriptionStatus: null,
    stripeCustomerId: null,
    currentPeriodEnd: null,
    trialEnd: null,
    cancelAtPeriodEnd: false,
  };

  const quota = await readPlanQuota(userId);
  const params = (await searchParams) ?? {};
  const justUpgraded = params.billing === "success";

  const isPro = quota.tier.isPro;
  const isComped = quota.tier.isComped;
  const hasStripeCustomer = Boolean(row.stripeCustomerId);
  const isCanceling = row.cancelAtPeriodEnd && isPro && !isComped;
  // current_period_end can be null when the webhook payload uses a Stripe API
  // version that moved the field onto subscription items. While the user is
  // still in `trialing`, trial_end is the correct fallback (Stripe will either
  // charge or cancel on that date). Post-trial we don't fall back — a stale
  // trial_end would render as a misleading past date.
  const accessEndsAt =
    row.currentPeriodEnd ??
    (row.subscriptionStatus === "trialing" ? row.trialEnd : null);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your subscription, payment method, and invoices.
        </p>
      </div>

      {justUpgraded && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm flex items-start gap-3">
          <Sparkles className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
          <div>
            <p className="font-medium">You&apos;re in.</p>
            <p className="text-muted-foreground mt-0.5">
              Pro features are unlocked. The session recap email lands after your
              next completed review.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-mono">
                Current plan
              </p>
              <p className="font-display text-2xl font-semibold mt-1">
                {isComped ? "Pro (comped)" : isPro ? "Pro" : "Free"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {describeStatus(row.subscriptionStatus, row.cancelAtPeriodEnd)}
              </p>
            </div>
            {!isPro && (
              <Button asChild>
                <Link href="/pricing">
                  Upgrade to Pro
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            )}
          </div>

          {isCanceling && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-500 flex-shrink-0" />
              <div className="space-y-1 flex-1">
                <p className="font-medium">
                  Your Pro access ends
                  {accessEndsAt ? ` on ${formatDate(accessEndsAt)}` : " at the period end"}.
                </p>
                <p className="text-muted-foreground">
                  After that you&apos;ll drop to the free plan (5 extractions/month, no
                  audio, no personalized sentences). Change your mind?
                </p>
              </div>
            </div>
          )}

          {isPro && !isComped && (
            <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-border/50">
              {row.trialEnd && row.subscriptionStatus === "trialing" && (
                <div>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-wide">
                    Trial ends
                  </p>
                  <p className="text-sm mt-1">{formatDate(row.trialEnd)}</p>
                </div>
              )}
              {accessEndsAt && (
                <div>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-wide">
                    {row.cancelAtPeriodEnd ? "Access ends" : "Renews"}
                  </p>
                  <p className="text-sm mt-1">{formatDate(accessEndsAt)}</p>
                </div>
              )}
            </div>
          )}

          {isComped && (
            <p className="text-xs text-muted-foreground border-t border-border/50 pt-3">
              Your account has been granted Pro access manually — no billing or
              payment method is on file.
            </p>
          )}

          {hasStripeCustomer && !isComped && (
            <div className="pt-2 border-t border-border/50">
              <BillingActions cancelAtPeriodEnd={row.cancelAtPeriodEnd} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-mono">
            {quota.breakdown && quota.breakdown.starter.remaining > 0
              ? "Extractions"
              : "This month"}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold">
              {quota.limit === Infinity || quota.limit > 999
                ? quota.remaining > 999
                  ? "Unlimited"
                  : `${quota.remaining}+`
                : `${quota.remaining}`}
            </span>
            <span className="text-sm text-muted-foreground">
              {quota.limit === Infinity || quota.limit > 999
                ? "extractions remaining"
                : quota.breakdown && quota.breakdown.starter.remaining > 0
                  ? "extractions left"
                  : `of ${quota.limit} extractions left`}
            </span>
          </div>

          {quota.breakdown && (
            <div className="pt-3 border-t border-border/50 space-y-2.5 text-sm">
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">
                    Monthly allowance
                  </span>
                  <span className="font-mono tabular-nums">
                    <span className="font-medium text-foreground">
                      {quota.breakdown.monthly.remaining}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}of {quota.breakdown.monthly.limit}
                    </span>
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Refills {formatShortDate(quota.breakdown.nextMonthlyResetAt)}
                </p>
              </div>

              {quota.breakdown.starter.remaining > 0 && (
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-muted-foreground">
                      Welcome bonus
                    </span>
                    <span className="font-mono tabular-nums">
                      <span className="font-medium text-foreground">
                        {quota.breakdown.starter.remaining}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}of {quota.breakdown.starter.limit}
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    One-time bonus on signup — no expiry, used before your monthly allowance.
                  </p>
                </div>
              )}
            </div>
          )}

          {!isPro && quota.remaining <= Math.max(1, Math.floor(quota.limit * 0.25)) && (
            <p className="text-xs text-muted-foreground pt-1">
              Running low? Pro removes the cap.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-mono mb-3">
            What Pro includes
          </p>
          <ul className="space-y-2 text-sm">
            {[
              "Unlimited extractions (fair use)",
              "3–5 personalized sentences per session, with audio",
              "Mid-session preview with audio at card 25",
              "Session recap email after every completed session",
              "Image retention and re-extraction",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
