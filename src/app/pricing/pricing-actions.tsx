"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import type { PlanKey, PlanDefinition } from "@/lib/stripe";

interface PricingActionsProps {
  userId: string | null;
  currentTier: string | null;
  catalog: Record<PlanKey, PlanDefinition | null>;
}

type Cadence = "monthly" | "annual";

export function PricingActions({ userId, currentTier, catalog }: PricingActionsProps) {
  const [cadence, setCadence] = useState<Cadence>("annual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For now, founder pricing is shown when configured. Once we hit 100 paid
  // subs we'll flip a config flag here (or remove the founder env vars).
  const monthly = catalog.pro_founder_monthly ?? catalog.pro_monthly;
  const annual = catalog.pro_founder_annual ?? catalog.pro_annual;
  const selectedPlan = cadence === "monthly" ? monthly : annual;
  const isFounder = (cadence === "monthly" ? catalog.pro_founder_monthly : catalog.pro_founder_annual) !== null;

  if (!userId) {
    return (
      <Button asChild className="w-full">
        <Link href={`/sign-up?redirect_url=${encodeURIComponent("/pricing")}`}>
          Start 7-day free trial
          <ArrowRight className="h-4 w-4 ml-2" />
        </Link>
      </Button>
    );
  }

  if (currentTier === "pro" || currentTier === "pro_comped") {
    return (
      <Button variant="outline" asChild className="w-full">
        <Link href="/dashboard/billing">Manage subscription</Link>
      </Button>
    );
  }

  const handleCheckout = async () => {
    if (!selectedPlan) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan.key,
          returnTo: "/dashboard/billing",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to start checkout");
      }
      window.location.href = data.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start checkout";
      setError(msg);
      setLoading(false);
    }
  };

  const noPlansConfigured = !monthly && !annual;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setCadence("monthly")}
          className={
            "rounded-lg border px-3 py-2 text-xs text-left transition-colors " +
            (cadence === "monthly"
              ? "border-primary bg-primary/5"
              : "border-border/60 hover:border-border")
          }
        >
          <div className="font-medium">Monthly</div>
          <div className="text-muted-foreground mt-0.5">
            {monthly ? `$${monthly.amountUsd}/mo` : "Coming soon"}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setCadence("annual")}
          className={
            "rounded-lg border px-3 py-2 text-xs text-left transition-colors " +
            (cadence === "annual"
              ? "border-primary bg-primary/5"
              : "border-border/60 hover:border-border")
          }
        >
          <div className="font-medium flex items-center gap-1.5">
            Annual
            {annual && (
              <span className="text-[9px] uppercase tracking-wide bg-primary/10 text-primary px-1 py-0.5 rounded">
                Save 17%
              </span>
            )}
          </div>
          <div className="text-muted-foreground mt-0.5">
            {annual ? `$${annual.amountUsd}/yr` : "Coming soon"}
          </div>
        </button>
      </div>

      {isFounder && selectedPlan && (
        <p className="text-[11px] text-muted-foreground">
          Founder pricing — locks in while your subscription stays active.
        </p>
      )}

      <Button
        onClick={handleCheckout}
        disabled={loading || !selectedPlan}
        className="w-full"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : null}
        {noPlansConfigured
          ? "Coming soon"
          : "Start 7-day free trial"}
        {!loading && selectedPlan && <ArrowRight className="h-4 w-4 ml-2" />}
      </Button>

      {error && <p className="text-xs text-jr-red">{error}</p>}
    </div>
  );
}
