"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#wild", label: "In the wild" },
  { href: "/pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function MobileNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  // Body scroll lock while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape closes; focus returns to the toggle.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    firstLinkRef.current?.focus();
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        className="relative h-10 w-10 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
      >
        <span
          className={`absolute block h-[1.5px] w-4 bg-foreground transition-transform duration-200 ease-out ${
            open ? "rotate-45" : "-translate-y-[3px]"
          }`}
        />
        <span
          className={`absolute block h-[1.5px] w-4 bg-foreground transition-transform duration-200 ease-out ${
            open ? "-rotate-45" : "translate-y-[3px]"
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-nav-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute left-0 right-0 top-full overflow-hidden bg-background/95 backdrop-blur-md border-b-2 border-dashed border-border"
          >
            <nav className="px-6 py-4" aria-label="Mobile">
              {LINKS.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut", delay: i * 0.06 }}
                >
                  <Link
                    ref={i === 0 ? firstLinkRef : undefined}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block py-3 text-base text-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
              <div className="my-3 border-t-2 border-dashed border-border" />
              <div className="flex flex-col gap-2 pb-2">
                {signedIn ? (
                  <Button asChild className="w-full">
                    <Link href="/dashboard" onClick={() => setOpen(false)}>
                      Dashboard
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" asChild className="w-full">
                      <Link href="/sign-in" onClick={() => setOpen(false)}>
                        Sign in
                      </Link>
                    </Button>
                    <Button asChild className="w-full">
                      <Link href="/sign-up" onClick={() => setOpen(false)}>
                        Get started
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
