"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useClerk } from "@clerk/nextjs";

// Two-step delete with email confirmation. Avoids a modal dependency
// (no Dialog primitive yet) by expanding the card inline when the user
// clicks the first button.

export function DeleteAccountSection({ email }: { email: string }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signOut } = useClerk();

  const canDelete = typed.trim().toLowerCase() === email.trim().toLowerCase();

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: typed.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to delete account");
      }
      // Clerk session is invalidated by the server. Sign out locally and
      // redirect home so the UI doesn't keep showing dashboard chrome.
      await signOut({ redirectUrl: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
      setLoading(false);
    }
  };

  return (
    <Card className="border-jr-red/30">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-jr-red flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wide text-jr-red font-mono">
              Danger zone
            </p>
            <p className="font-display text-lg font-semibold mt-1">Delete account</p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Permanently delete your account, all your cards and vocabulary,
              review history, generated sentences, and uploaded images. Any
              active subscription is canceled immediately — no refund unless
              specifically arranged. This cannot be undone.
            </p>
          </div>
        </div>

        {!confirming ? (
          <Button
            variant="outline"
            className="border-jr-red/40 text-jr-red hover:bg-jr-red/5 hover:text-jr-red"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            I want to delete my account
          </Button>
        ) : (
          <div className="space-y-3 rounded-lg border border-jr-red/20 bg-jr-red/[0.03] p-4">
            <div>
              <label
                htmlFor="confirm-email"
                className="text-xs font-medium text-foreground"
              >
                Type <span className="font-mono">{email}</span> to confirm
              </label>
              <input
                id="confirm-email"
                type="email"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-jr-red/30"
                placeholder="your-email@example.com"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setConfirming(false);
                  setTyped("");
                  setError(null);
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                className="bg-jr-red text-white hover:bg-jr-red/90"
                onClick={handleDelete}
                disabled={!canDelete || loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                {loading ? "Deleting…" : "Delete forever"}
              </Button>
            </div>
            {error && <p className="text-xs text-jr-red">{error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
