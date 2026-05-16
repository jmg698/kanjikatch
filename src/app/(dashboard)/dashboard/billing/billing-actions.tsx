"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, ArrowRight } from "lucide-react";

interface BillingActionsProps {
  cancelAtPeriodEnd: boolean;
}

export function BillingActions({ cancelAtPeriodEnd }: BillingActionsProps) {
  const router = useRouter();
  const [portalLoading, setPortalLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnTo: "/dashboard/billing" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to open billing portal");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open billing portal");
      setPortalLoading(false);
    }
  };

  const handleResume = async () => {
    setResumeLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/resume", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to resume subscription");
      // Stripe fires customer.subscription.updated immediately; by the time the
      // server component re-renders, cancel_at_period_end should be cleared.
      // A small refresh is enough — no need for optimistic UI.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resume subscription");
    } finally {
      setResumeLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      {cancelAtPeriodEnd && (
        <Button onClick={handleResume} disabled={resumeLoading}>
          {resumeLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4 mr-2" />
          )}
          Resume subscription
        </Button>
      )}
      <div>
        <Button variant="outline" onClick={handleOpenPortal} disabled={portalLoading}>
          {portalLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ExternalLink className="h-4 w-4 mr-2" />
          )}
          Manage subscription
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          Update payment method, view invoices, or cancel — all through the secure
          Stripe portal.
        </p>
      </div>
      {error && <p className="text-xs text-jr-red">{error}</p>}
    </div>
  );
}
