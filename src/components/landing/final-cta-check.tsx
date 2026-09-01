"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";

// The one spring on the entire page — a session-complete checkmark shown at
// dusk. Everything else is an easeOut tween; this is the celebratory beat.
export function FinalCtaCheck() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="wild-golden-panel inline-flex items-center gap-3 !px-5 !py-3"
    >
      <motion.span
        initial={reduceMotion ? { scale: 1 } : { scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", delay: 0.2 }}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500"
      >
        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
      </motion.span>
      <span className="font-mono tabular-nums text-sm text-[#F5F0E6]/80">3/3</span>
      <span className="text-sm text-[#F5F0E6]">Nice work — that&apos;s a wrap.</span>
    </motion.div>
  );
}
