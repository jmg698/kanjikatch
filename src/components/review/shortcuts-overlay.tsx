"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface ShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
  canUndo: boolean;
}

interface Shortcut {
  keys: string[];
  description: string;
  disabled?: boolean;
}

export function ShortcutsOverlay({ open, onClose, canUndo }: ShortcutsOverlayProps) {
  const shortcuts: Shortcut[] = [
    { keys: ["Space"], description: "Reveal answer" },
    { keys: ["1"], description: "Again — forgot completely" },
    { keys: ["2"], description: "Hard — barely remembered" },
    { keys: ["3"], description: "Good — knew it" },
    { keys: ["4"], description: "Easy — knew instantly" },
    { keys: ["U", "←"], description: "Redo last card", disabled: !canUndo },
    { keys: ["?"], description: "Toggle this overlay" },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="shortcuts-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
              <h2 className="text-base font-semibold">Keyboard shortcuts</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="px-5 py-4 space-y-2.5">
              {shortcuts.map((s) => (
                <li
                  key={s.description}
                  className={`flex items-center justify-between gap-4 ${s.disabled ? "opacity-40" : ""}`}
                >
                  <span className="text-sm text-foreground">{s.description}</span>
                  <span className="flex items-center gap-1">
                    {s.keys.map((k, i) => (
                      <span key={k} className="flex items-center gap-1">
                        {i > 0 && <span className="text-xs text-muted-foreground">or</span>}
                        <kbd className="px-2 py-1 rounded-md bg-secondary border border-border text-xs font-mono">
                          {k}
                        </kbd>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <div className="px-5 py-3 border-t border-border/60 bg-secondary/30">
              <p className="text-xs text-muted-foreground text-center">
                Press <kbd className="px-1 py-0.5 rounded bg-white border border-border text-[10px] font-mono">?</kbd> any time to reopen this list.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
