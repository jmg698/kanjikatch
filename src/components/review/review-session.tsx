"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Home, CheckCircle2, Keyboard, BookOpen } from "lucide-react";
import { PreReview } from "./pre-review";
import { ReviewCard } from "./review-card";
import { ReviewSummary } from "./review-summary";
import { StaticShinkansenBackground } from "./static-shinkansen-background";
import { ShortcutsOverlay } from "./shortcuts-overlay";
import { InterludeBackground } from "./interlude-background";
import { InterludeReading } from "./interlude-reading";
import { InTheWild } from "@/components/wild/in-the-wild";
import { StaticGoldenHourBackground } from "@/components/wild/static-golden-hour-background";
import type { WildSentenceData } from "@/components/wild/in-the-wild";
import type { DifficultyRating } from "@/components/wild/sentence-display";
import type { DueCounts, ReviewQueueItem, ReviewStats, SessionSummary, SessionType, QueueEntry, RequeueState, UndoSnapshot } from "./review-types";
import type { Grade } from "@/lib/srs";

type Phase = "setup" | "reviewing" | "interlude" | "summary" | "wild";

// Mid-session reading interlude config — kept tight on purpose.
const INTERLUDE_SEGMENT_SIZE = 25;
const INTERLUDE_MIN_TAIL = 10;
const INTERLUDE_SENTENCE_COUNT = 2;

export function ReviewSession() {
  const searchParams = useSearchParams();
  const sizeParam = searchParams?.get("size") ?? null;
  // Persist the requested size across "Review Again" within this page lifecycle.
  // null = no auto-start (caller wants the manual fallback UI).
  const requestedSizeRef = useRef<number | "all" | null>(
    sizeParam === null
      ? "all"
      : sizeParam === "all"
        ? "all"
        : Number.isFinite(parseInt(sizeParam, 10)) && parseInt(sizeParam, 10) > 0
          ? parseInt(sizeParam, 10)
          : "all",
  );

  const [phase, setPhase] = useState<Phase>("setup");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // Guard so the auto-start effect only fires once per setup-phase entry.
  const autoStartedRef = useRef(false);

  // Setup state
  const [dueCounts, setDueCounts] = useState<DueCounts>({ kanji: 0, vocab: 0, total: 0 });
  const [stats, setStats] = useState<ReviewStats | null>(null);

  // Review state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [totalXpEarned, setTotalXpEarned] = useState(0);
  const previousLevelRef = useRef(1);

  // Intra-session re-queue tracking (refs for synchronous access in handleGrade)
  const requeueMapRef = useRef<Map<string, RequeueState>>(new Map());
  const entryIdCounterRef = useRef(0);
  const originalQueueSizeRef = useRef(0);

  // Summary state
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [leveledUp, setLeveledUp] = useState(false);

  // Wild sentences prefetch (fire early so it runs in parallel with session completion)
  const [wildPrefetchStatus, setWildPrefetchStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  // Mid-session reading interlude. Triggered every INTERLUDE_SEGMENT_SIZE
  // originally-completed cards when there are still enough cards remaining
  // (INTERLUDE_MIN_TAIL) to make the resumption feel meaningful.
  const [interludeSentences, setInterludeSentences] = useState<WildSentenceData[]>([]);
  const [interludeLoading, setInterludeLoading] = useState(false);
  const [interludeRatings, setInterludeRatings] = useState<Record<string, DifficultyRating>>({});
  const interludeSeenSegmentsRef = useRef<Set<number>>(new Set());

  // Correct/wrong flash
  const [flashColor, setFlashColor] = useState<string | null>(null);

  // Undo state — tracks the most recent submission so the user can reverse it
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);
  const [undoing, setUndoing] = useState(false);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Derived progress: original cards completed vs retries remaining
  const { completedOriginal, retriesRemaining } = useMemo(() => {
    let completed = 0;
    let retries = 0;
    for (let i = 0; i < queue.length; i++) {
      if (i < currentIndex && !queue[i].isRetry) completed++;
      if (i >= currentIndex && queue[i].isRetry) retries++;
    }
    return { completedOriginal: completed, retriesRemaining: retries };
  }, [queue, currentIndex]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/review/stats");
      if (!res.ok) return;
      const data = await res.json();
      setStats(data.stats);
      setDueCounts(data.due);
    } catch (e) {
      console.error("Failed to fetch stats:", e);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    fetchStats().finally(() => setLoading(false));
  }, [fetchStats]);

  const prefetchWildSentences = useCallback((sid: string) => {
    setWildPrefetchStatus("loading");
    fetch("/api/sentences/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sid }),
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Generation failed");
      })
      .then((data) => {
        setWildPrefetchStatus(data.sentences?.length > 0 ? "ready" : "error");
      })
      .catch(() => {
        setWildPrefetchStatus("error");
      });
  }, []);

  const startSession = useCallback(async (type: SessionType, size: number) => {
    setLoading(true);
    try {
      const queueRes = await fetch(`/api/review/queue?type=${type}&limit=${size}`);
      if (!queueRes.ok) throw new Error("Failed to fetch queue");
      const queueData = await queueRes.json();

      if (queueData.items.length === 0) {
        setLoading(false);
        return;
      }

      const sessionRes = await fetch("/api/review/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", sessionType: type }),
      });
      if (!sessionRes.ok) throw new Error("Failed to start session");
      const sessionData = await sessionRes.json();

      entryIdCounterRef.current = 0;
      const entries: QueueEntry[] = queueData.items.map((item: ReviewQueueItem) => ({
        item,
        isRetry: false,
        retryReason: undefined,
        entryId: entryIdCounterRef.current++,
      }));

      previousLevelRef.current = stats?.level ?? 1;
      setSessionId(sessionData.sessionId);
      setQueue(entries);
      setCurrentIndex(0);
      setConsecutiveCorrect(0);
      setTotalXpEarned(0);

      requeueMapRef.current = new Map();
      originalQueueSizeRef.current = entries.length;
      setUndoSnapshot(null);

      interludeSeenSegmentsRef.current = new Set();
      setInterludeSentences([]);
      setInterludeRatings({});
      setInterludeLoading(false);

      setPhase("reviewing");
    } catch (e) {
      console.error("Failed to start session:", e);
    } finally {
      setLoading(false);
    }
  }, [stats?.level]);

  // Auto-start a session as soon as we know how many cards are due.
  // The dashboard launches review with intent "do my reviews now" — the size
  // picker has moved to a customize modal there, so this screen no longer
  // needs to ask the user anything in the common case.
  useEffect(() => {
    if (phase !== "setup") return;
    if (loading) return;
    if (autoStartedRef.current) return;
    if (dueCounts.total === 0) return;
    if (requestedSizeRef.current === null) return;

    autoStartedRef.current = true;
    const size = requestedSizeRef.current === "all"
      ? dueCounts.total
      : Math.min(requestedSizeRef.current, dueCounts.total);
    startSession("mixed", size);
  }, [phase, loading, dueCounts.total, startSession]);

  // Trigger a mid-session reading interlude for the segment we just finished.
  // Sentences are fetched on-demand: the request fires as soon as we set the
  // interlude phase so the user sees a brief "preparing" moment instead of a
  // pre-roll loading screen. If generation fails or returns no sentences we
  // silently slip back into review — interludes should never block progress.
  const triggerInterlude = useCallback(
    async (segmentIndex: number, sid: string) => {
      if (interludeSeenSegmentsRef.current.has(segmentIndex)) return;
      interludeSeenSegmentsRef.current.add(segmentIndex);

      setInterludeSentences([]);
      setInterludeLoading(true);
      setPhase("interlude");

      try {
        const res = await fetch("/api/sentences/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sid,
            segmentIndex,
            count: INTERLUDE_SENTENCE_COUNT,
          }),
        });
        if (!res.ok) throw new Error("Failed to load interlude");
        const data = await res.json();
        const sentences: WildSentenceData[] = data.sentences ?? [];
        if (sentences.length === 0) {
          // Nothing to read — slip straight back into review.
          setPhase("reviewing");
          return;
        }
        setInterludeSentences(sentences);
      } catch (e) {
        console.error("Interlude generation failed:", e);
        setPhase("reviewing");
      } finally {
        setInterludeLoading(false);
      }
    },
    [],
  );

  const handleInterludeRate = useCallback(
    async (sentenceId: string, rating: DifficultyRating) => {
      setInterludeRatings((prev) => ({ ...prev, [sentenceId]: rating }));
      try {
        await fetch("/api/sentences/rate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sentenceId, rating }),
        });
      } catch {
        // Silent fail — rating is held client-side and re-attempted next time.
      }
    },
    [],
  );

  const handleInterludeComplete = useCallback(() => {
    setPhase("reviewing");
  }, []);

  const handleGrade = async (grade: Grade) => {
    if (submitting || undoing || !sessionId) return;
    setSubmitting(true);

    const entry = queue[currentIndex];
    const { item, isRetry } = entry;
    const wasCorrect = grade !== "again";

    setFlashColor(wasCorrect ? "emerald" : "orange");
    setTimeout(() => setFlashColor(null), 400);

    // Snapshot pre-grade state so the user can undo this submission
    const queueSnapshot = queue.map((e) => ({ ...e }));
    const requeueSnapshot = requeueMapRef.current.get(item.trackId) ?? null;
    const baseSnapshot = {
      prevQueue: queueSnapshot,
      prevCurrentIndex: currentIndex,
      prevConsecutiveCorrect: consecutiveCorrect,
      prevTotalXpEarned: totalXpEarned,
      prevRequeueState: requeueSnapshot ? { ...requeueSnapshot } : null,
      isRetry,
      trackId: item.trackId,
      xpEarned: 0,
    };

    let shouldRequeue = false;
    let pendingSnapshot: UndoSnapshot = baseSnapshot;

    try {
      if (!isRetry) {
        // First appearance — submit to API for SRS update + history
        const res = await fetch("/api/review/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            itemId: item.id,
            itemType: item.type,
            questionType: item.questionType,
            grade,
            consecutiveCorrect,
          }),
        });

        if (!res.ok) throw new Error("Failed to submit");
        const data = await res.json();
        setTotalXpEarned((prev) => prev + (data.xpEarned || 0));

        pendingSnapshot = {
          ...baseSnapshot,
          historyId: data.historyId,
          serverTrackId: data.trackId,
          priorTrackState: data.priorTrackState,
          xpEarned: data.xpEarned ?? 0,
        };

        if (grade === "again") {
          requeueMapRef.current.set(item.trackId, {
            tier: "again",
            consecutiveCorrect: 0,
            requiredCorrect: 2,
          });
          shouldRequeue = true;
        } else if (grade === "hard") {
          requeueMapRef.current.set(item.trackId, {
            tier: "hard",
            consecutiveCorrect: 0,
            requiredCorrect: 1,
          });
          shouldRequeue = true;
        }
      } else {
        // Retry — session-local only, no API call, no SRS update
        const state = requeueMapRef.current.get(item.trackId);
        if (state) {
          if (wasCorrect) {
            const newConsecutive = state.consecutiveCorrect + 1;
            if (newConsecutive >= state.requiredCorrect) {
              requeueMapRef.current.delete(item.trackId);
            } else {
              state.consecutiveCorrect = newConsecutive;
              shouldRequeue = true;
            }
          } else {
            if (state.tier === "hard") {
              state.tier = "again";
              state.requiredCorrect = 2;
            }
            state.consecutiveCorrect = 0;
            shouldRequeue = true;
          }
        }
      }

      // Re-insert into queue with 4-6 card spacing
      let updatedQueue = queue;
      if (shouldRequeue) {
        const spacing = Math.floor(Math.random() * 3) + 4;
        const insertAt = Math.min(currentIndex + 1 + spacing, queue.length);
        const retryEntry: QueueEntry = {
          item,
          isRetry: true,
          retryReason: requeueMapRef.current.get(item.trackId)?.tier === "again" ? "missed" : "hard",
          entryId: entryIdCounterRef.current++,
        };
        updatedQueue = [...queue];
        updatedQueue.splice(insertAt, 0, retryEntry);
        setQueue(updatedQueue);
      }

      if (wasCorrect) {
        setConsecutiveCorrect((prev) => prev + 1);
      } else {
        setConsecutiveCorrect(0);
      }

      const nextIndex = currentIndex + 1;
      if (nextIndex >= updatedQueue.length) {
        // No undo available across session completion
        setUndoSnapshot(null);
        prefetchWildSentences(sessionId);
        await completeSession();
      } else {
        setCurrentIndex(nextIndex);
        setUndoSnapshot(pendingSnapshot);

        // Reading interlude check: every INTERLUDE_SEGMENT_SIZE original-card
        // completions, if at least INTERLUDE_MIN_TAIL cards remain afterward.
        // Retries don't count toward the milestone — a wobbly streak should
        // not shift the cadence.
        if (!isRetry) {
          const newCompletedOriginal = completedOriginal + 1;
          const reachedMilestone =
            newCompletedOriginal > 0 && newCompletedOriginal % INTERLUDE_SEGMENT_SIZE === 0;
          if (reachedMilestone) {
            const cardsRemainingAfter = updatedQueue.length - nextIndex;
            if (cardsRemainingAfter >= INTERLUDE_MIN_TAIL) {
              const segmentIndex = newCompletedOriginal / INTERLUDE_SEGMENT_SIZE - 1;
              // Undo can't survive an interlude boundary — too confusing.
              setUndoSnapshot(null);
              triggerInterlude(segmentIndex, sessionId);
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to submit grade:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUndo = useCallback(async () => {
    if (!undoSnapshot || undoing || submitting || !sessionId) return;
    setUndoing(true);
    try {
      // For first-appearance grades, reverse the server-side mutation.
      if (
        !undoSnapshot.isRetry &&
        undoSnapshot.historyId &&
        undoSnapshot.serverTrackId &&
        undoSnapshot.priorTrackState
      ) {
        const res = await fetch("/api/review/undo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            historyId: undoSnapshot.historyId,
            trackId: undoSnapshot.serverTrackId,
            xpEarned: undoSnapshot.xpEarned,
            priorTrackState: undoSnapshot.priorTrackState,
          }),
        });
        if (!res.ok) throw new Error("Undo failed");
      }

      // Restore client state
      setQueue(undoSnapshot.prevQueue);
      setCurrentIndex(undoSnapshot.prevCurrentIndex);
      setConsecutiveCorrect(undoSnapshot.prevConsecutiveCorrect);
      setTotalXpEarned(undoSnapshot.prevTotalXpEarned);

      // Restore the in-session requeue tracker for this trackId
      if (undoSnapshot.prevRequeueState) {
        requeueMapRef.current.set(undoSnapshot.trackId, { ...undoSnapshot.prevRequeueState });
      } else {
        requeueMapRef.current.delete(undoSnapshot.trackId);
      }

      setUndoSnapshot(null);
    } catch (e) {
      console.error("Failed to undo grade:", e);
    } finally {
      setUndoing(false);
    }
  }, [undoSnapshot, undoing, submitting, sessionId]);

  const completeSession = async () => {
    if (!sessionId) return;

    try {
      const res = await fetch("/api/review/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", sessionId }),
      });

      if (!res.ok) throw new Error("Failed to complete session");
      const data = await res.json();

      setSummary(data.summary);

      // Refresh stats
      await fetchStats();

      // Check for level up
      const newLevel = stats?.level ?? 1;
      if (newLevel > previousLevelRef.current) {
        setLeveledUp(true);
      }

      setPhase("summary");
    } catch (e) {
      console.error("Failed to complete session:", e);
      setPhase("summary");
    }
  };

  const handleReviewAgain = () => {
    setPhase("setup");
    setLeveledUp(false);
    setSummary(null);
    setSessionId(null);
    setQueue([]);
    setWildPrefetchStatus("idle");
    requeueMapRef.current = new Map();
    originalQueueSizeRef.current = 0;
    autoStartedRef.current = false;
    interludeSeenSegmentsRef.current = new Set();
    setInterludeSentences([]);
    setInterludeRatings({});
    setInterludeLoading(false);
    fetchStats();
  };

  const handleShowWild = () => {
    setPhase("wild");
  };

  const handleEndSessionEarly = useCallback(() => {
    if (sessionId && queue.length > 0) {
      prefetchWildSentences(sessionId);
      completeSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, queue.length, prefetchWildSentences]);

  // Session-level shortcuts: U / Backspace / ArrowLeft to undo, ? to open shortcuts.
  // Card-level shortcuts (Space, 1–4) live inside ReviewCard.
  useEffect(() => {
    if (phase !== "reviewing") return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }

      if (shortcutsOpen && e.key === "Escape") {
        e.preventDefault();
        setShortcutsOpen(false);
        return;
      }

      if (
        (e.key === "u" || e.key === "U" || e.key === "Backspace" || e.key === "ArrowLeft") &&
        undoSnapshot &&
        !submitting &&
        !undoing
      ) {
        e.preventDefault();
        handleUndo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, undoSnapshot, submitting, undoing, shortcutsOpen, handleUndo]);

  const isFullScreen =
    phase === "reviewing" || phase === "interlude" || phase === "summary" || phase === "wild";
  const isReviewOrInterlude = phase === "reviewing" || phase === "interlude";

  return (
    <>
      {/* Setup: normal in-page layout */}
      {phase === "setup" && (
        <div className="relative min-h-[60vh]">
          {loading ? (
            <div className="max-w-lg mx-auto space-y-4 pt-6">
              <div className="h-8 bg-secondary animate-pulse rounded-lg w-48 mx-auto" />
              <div className="h-40 bg-secondary animate-pulse rounded-2xl" />
              <div className="h-12 bg-secondary animate-pulse rounded-lg" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key="setup"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <PreReview
                  dueCounts={dueCounts}
                  stats={stats}
                  onStart={startSession}
                  loading={loading}
                />
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Full-screen review & summary: covers entire viewport, no nav */}
      <AnimatePresence>
        {isFullScreen && (
          <motion.div
            key="fullscreen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`fixed inset-0 z-[100] flex flex-col ${isReviewOrInterlude ? "" : "bg-background"}`}
          >
            {/* Backgrounds crossfade between review (shinkansen pastel-blue)
                and interlude (warm buttercup) — same room, different light. */}
            <AnimatePresence>
              {phase === "reviewing" && (
                <motion.div
                  key="bg-review"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, ease: "easeInOut" }}
                  className="absolute inset-0 z-0"
                >
                  <StaticShinkansenBackground />
                </motion.div>
              )}
              {phase === "interlude" && (
                <motion.div
                  key="bg-interlude"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, ease: "easeInOut" }}
                  className="absolute inset-0 z-0"
                >
                  <InterludeBackground />
                </motion.div>
              )}
            </AnimatePresence>
            {/* Flash feedback overlay (inside full-screen so it stays on top of content) */}
            <AnimatePresence>
              {flashColor && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.08 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute inset-0 z-40 pointer-events-none ${
                    flashColor === "emerald" ? "bg-emerald-500" : "bg-orange-500"
                  }`}
                />
              )}
            </AnimatePresence>

            {isReviewOrInterlude && queue.length > 0 && (
              <div className="relative z-10 flex flex-col flex-1 min-h-0">
                {/* Minimal header: exit + progress only. Stays put during the
                    reading interlude — same chrome, just a different room. */}
                <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/95 backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={handleEndSessionEarly}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg p-2 -ml-2"
                    aria-label="End session"
                  >
                    <Home className="h-5 w-5" />
                    <span className="text-sm font-medium hidden sm:inline">Exit</span>
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                      <span className="font-mono">{completedOriginal}</span>
                      <span className="opacity-50">/</span>
                      <span className="font-mono">{originalQueueSizeRef.current}</span>
                      {retriesRemaining > 0 && (
                        <span className="text-xs text-orange-500 font-medium ml-0.5">
                          +{retriesRemaining}
                        </span>
                      )}
                    </span>
                    <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden hidden sm:block">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={false}
                        animate={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                      />
                    </div>
                    {phase === "reviewing" ? (
                      <button
                        type="button"
                        onClick={() => setShortcutsOpen(true)}
                        className="text-muted-foreground hover:text-foreground transition-colors rounded-lg p-1.5 -mr-1"
                        aria-label="Keyboard shortcuts"
                        title="Keyboard shortcuts (?)"
                      >
                        <Keyboard className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="text-muted-foreground p-1.5 -mr-1" aria-hidden>
                        <BookOpen className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </header>

                <div className="flex-1 flex flex-col min-h-0 overflow-auto">
                  <div className="flex-1 flex items-center justify-center p-6 pt-8 pb-32 md:pb-40">
                    <AnimatePresence mode="wait">
                      {phase === "reviewing" ? (
                        <motion.div
                          key="reviewing"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.2 }}
                          className="w-full max-w-2xl mx-auto"
                        >
                          <ReviewCard
                            item={queue[currentIndex].item}
                            index={currentIndex}
                            total={queue.length}
                            questionType={queue[currentIndex].item.questionType}
                            consecutiveCorrect={consecutiveCorrect}
                            onGrade={handleGrade}
                            disabled={submitting || undoing || shortcutsOpen}
                            fullScreen
                            isRetry={queue[currentIndex].isRetry}
                            retryReason={queue[currentIndex].retryReason}
                            canUndo={!!undoSnapshot}
                            onUndo={handleUndo}
                            undoing={undoing}
                          />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="interlude"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.3 }}
                          className="w-full"
                        >
                          {interludeLoading || interludeSentences.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-4 py-10 text-amber-900/70">
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                              >
                                <BookOpen className="h-8 w-8" />
                              </motion.div>
                              <p className="text-sm">Preparing your reading…</p>
                            </div>
                          ) : (
                            <InterludeReading
                              sentences={interludeSentences}
                              ratings={interludeRatings}
                              onRate={handleInterludeRate}
                              onComplete={handleInterludeComplete}
                            />
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            )}

            {phase === "summary" && summary && (
              <div className="flex-1 min-h-0 overflow-auto flex flex-col items-center justify-center p-6">
                <motion.div
                  key="summary"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="w-full max-w-lg"
                >
                  <ReviewSummary
                    summary={summary}
                    stats={stats}
                    leveledUp={leveledUp}
                    previousLevel={previousLevelRef.current}
                    onReviewAgain={handleReviewAgain}
                    onBackToDashboard={() => (window.location.href = "/dashboard")}
                    onShowWild={handleShowWild}
                    sessionId={summary.sessionId}
                    wildPrefetchStatus={wildPrefetchStatus}
                  />
                </motion.div>
              </div>
            )}

            {phase === "wild" && sessionId && (
              <motion.div
                key="wild"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="flex-1 min-h-0 relative"
              >
                <StaticGoldenHourBackground />
                <div className="relative z-10 h-full">
                  <InTheWild
                    sessionId={sessionId}
                    onClose={() => (window.location.href = "/dashboard")}
                    onBackToDashboard={() => (window.location.href = "/dashboard")}
                  />
                </div>
              </motion.div>
            )}

            {phase === "reviewing" && (
              <ShortcutsOverlay
                open={shortcutsOpen}
                onClose={() => setShortcutsOpen(false)}
                canUndo={!!undoSnapshot}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
