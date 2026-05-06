"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface ReviewLauncherProps {
  totalDue: number;
}

const SESSION_SIZES: (number | "all")[] = [5, 15, 25, 50, "all"];

export function ReviewLauncher({ totalDue }: ReviewLauncherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);

  const launch = useCallback(
    (size: number | "all") => {
      if (navigating) return;
      setNavigating(true);
      const param = size === "all" ? "all" : String(size);
      router.push(`/review?size=${param}`);
    },
    [router, navigating],
  );

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      <div className="mt-auto pt-4 flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={() => launch("all")}
          disabled={navigating}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-70"
        >
          Start Review
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Customize session
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            key="custom-session-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
            onClick={close}
          >
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 10, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-sm rounded-2xl bg-background border border-border shadow-2xl p-5"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Customize review session"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Custom session</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {totalDue} due — pick how many to review now
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="text-muted-foreground hover:text-foreground transition-colors -mr-1 -mt-1 p-1"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {SESSION_SIZES.map((size) => {
                  const label = size === "all" ? "All" : String(size);
                  const effective = size === "all" ? totalDue : Math.min(size, totalDue);
                  const disabled = navigating || effective === 0;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => launch(size)}
                      disabled={disabled}
                      className={`
                        py-3 rounded-lg border-2 font-medium text-sm transition-all
                        ${size === "all" ? "" : "font-mono"}
                        border-border hover:border-primary hover:bg-primary/5 hover:text-primary
                        text-foreground disabled:opacity-50 disabled:cursor-not-allowed
                        active:scale-[0.97]
                      `}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
