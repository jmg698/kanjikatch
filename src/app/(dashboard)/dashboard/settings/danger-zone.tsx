"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

const CONFIRM_PHRASE = "DELETE";

export function DangerZone() {
  const router = useRouter();
  const { signOut } = useClerk();
  const [expanded, setExpanded] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmInput.trim() === CONFIRM_PHRASE;

  const handleDelete = async () => {
    if (!canDelete || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete account");
      }
      // Clerk user is gone; clear the local session and bounce to home.
      // The signOut call will also redirect on its own, but the explicit
      // router.replace handles the case where signOut races with the
      // Clerk middleware revalidation.
      await signOut({ redirectUrl: "/" });
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
      setLoading(false);
    }
  };

  if (!expanded) {
    return (
      <Button
        variant="outline"
        className="text-destructive border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
        onClick={() => setExpanded(true)}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Delete account
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive flex-shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-destructive">This is permanent.</p>
          <p className="text-muted-foreground mt-1">
            All your kanji, vocabulary, sentences, review history, and source
            images will be deleted immediately. Type{" "}
            <span className="font-mono font-semibold text-foreground">
              {CONFIRM_PHRASE}
            </span>{" "}
            below to confirm.
          </p>
        </div>
      </div>

      <input
        type="text"
        value={confirmInput}
        onChange={(e) => setConfirmInput(e.target.value)}
        placeholder={CONFIRM_PHRASE}
        autoComplete="off"
        disabled={loading}
        aria-label={`Type ${CONFIRM_PHRASE} to confirm`}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
      />

      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={!canDelete || loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 mr-2" />
          )}
          Delete my account permanently
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setExpanded(false);
            setConfirmInput("");
            setError(null);
          }}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
