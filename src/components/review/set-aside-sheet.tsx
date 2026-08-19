"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Archive, HelpCircle, X } from "lucide-react";
import type { FlagReason } from "@/db/schema";

interface SetAsideSheetProps {
  open: boolean;
  /** The card's prompt, echoed back so the user is sure what they're parking. */
  prompt: string;
  onCancel: () => void;
  onConfirm: (reason: FlagReason) => void;
  /** Disables both choices while the request is in flight. */
  pending?: boolean;
}

/**
 * Asks *why* a card is being pulled out of rotation.
 *
 * The reason is captured here rather than at triage time because it routes the
 * card: "the info looks wrong" also queues the item for a definition repair,
 * while "I don't need this" simply parks it. Both leave the card ungraded — no
 * SRS change, nothing recorded against accuracy or the streak.
 */
const REASONS: {
  reason: FlagReason;
  key: string;
  label: string;
  hint: string;
  accent: string;
}[] = [
  {
    reason: "not_needed",
    key: "1",
    label: "I don't need this card",
    hint: "Park it. You can delete it or bring it back from your library.",
    accent: "hover:border-slate-300 hover:bg-slate-50",
  },
  {
    reason: "bad_data",
    key: "2",
    label: "The info looks wrong",
    hint: "Park it and try to fix the definition in the background.",
    accent: "hover:border-amber-300 hover:bg-amber-50",
  },
];

export function SetAsideSheet({
  open,
  prompt,
  onCancel,
  onConfirm,
  pending = false,
}: SetAsideSheetProps) {
  // 1 / 2 pick a reason, Escape backs out. These deliberately shadow the grade
  // shortcuts while the sheet is up — the session disables the card's own
  // handlers whenever this is open.
  useEffect(() => {
    if (!open || pending) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      const match = REASONS.find((r) => r.key === e.key);
      if (match) {
        e.preventDefault();
        onConfirm(match.reason);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, pending, onCancel, onConfirm]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="set-aside-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={pending ? undefined : onCancel}
          role="dialog"
          aria-modal="true"
          aria-label="Set this card aside"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border/60">
              <div className="min-w-0">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Archive className="h-4 w-4 text-muted-foreground" aria-hidden />
                  Set aside
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground truncate">
                  {prompt}
                </p>
              </div>
              <button
                type="button"
                onClick={onCancel}
                disabled={pending}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
                aria-label="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-2">
              {REASONS.map((r) => (
                <button
                  key={r.reason}
                  type="button"
                  onClick={() => onConfirm(r.reason)}
                  disabled={pending}
                  className={`w-full text-left rounded-xl border-2 border-border bg-white px-4 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${r.accent}`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{r.label}</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[10px] font-mono shrink-0">
                      {r.key}
                    </kbd>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground leading-snug">
                    {r.hint}
                  </span>
                </button>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-border/60 bg-secondary/30">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <HelpCircle className="h-3 w-3 shrink-0" aria-hidden />
                Either way this card isn&rsquo;t graded — your streak and accuracy
                stay untouched.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
