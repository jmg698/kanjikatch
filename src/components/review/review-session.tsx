"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Home, CheckCircle2 } from "lucide-react";
import { PreReview } from "./pre-review";
import { ReviewCard } from "./review-card";
import { ReviewSummary } from "./review-summary";
import type { DueCounts, ReviewQueueItem, ReviewStats, SessionSummary, SessionType } from "./review-types";
import type { Grade } from "@/lib/srs";

type Phase = "setup" | "reviewing" | "summary";

export function ReviewSession() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Setup state
  const [dueCounts, setDueCounts] = useState<DueCounts>({ kanji: 0, vocab: 0, total: 0 });
  const [stats, setStats] = useState<ReviewStats | null>(null);

  // Review state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionType, setQuestionType] = useState<"meaning" | "reading">("meaning");
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [totalXpEarned, setTotalXpEarned] = useState(0);
  const previousLevelRef = useRef(1);

  // Summary state
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [leveledUp, setLeveledUp] = useState(false);

  // Correct/wrong flash
  const [flashColor, setFlashColor] = useState<string | null>(null);

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

  const startSession = async (type: SessionType, size: number) => {
    setLoading(true);
    try {
      // Fetch queue
      const queueRes = await fetch(`/api/review/queue?type=${type}&limit=${size}`);
      if (!queueRes.ok) throw new Error("Failed to fetch queue");
      const queueData = await queueRes.json();

      if (queueData.items.length === 0) {
        setLoading(false);
        return;
      }

      // Start session
      const sessionRes = await fetch("/api/review/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", sessionType: type }),
      });
      if (!sessionRes.ok) throw new Error("Failed to start session");
      const sessionData = await sessionRes.json();

      previousLevelRef.current = stats?.level ?? 1;
      setSessionId(sessionData.sessionId);
      setQueue(queueData.items);
      setCurrentIndex(0);
      setConsecutiveCorrect(0);
      setTotalXpEarned(0);
      setQuestionType(Math.random() > 0.5 ? "meaning" : "reading");
      setPhase("reviewing");
    } catch (e) {
      console.error("Failed to start session:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleGrade = async (grade: Grade) => {
    if (submitting || !sessionId) return;
    setSubmitting(true);

    const item = queue[currentIndex];
    const wasCorrect = grade !== "again";

    // Visual feedback
    setFlashColor(wasCorrect ? "emerald" : "orange");
    setTimeout(() => setFlashColor(null), 400);

    try {
      const res = await fetch("/api/review/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          itemId: item.id,
          itemType: item.type,
          questionType,
          grade,
          consecutiveCorrect,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit");
      const data = await res.json();

      setTotalXpEarned((prev) => prev + (data.xpEarned || 0));

      if (wasCorrect) {
        setConsecutiveCorrect((prev) => prev + 1);
      } else {
        setConsecutiveCorrect(0);
      }

      // Move to next item
      const nextIndex = currentIndex + 1;
      if (nextIndex >= queue.length) {
        await completeSession();
      } else {
        setCurrentIndex(nextIndex);
        setQuestionType(Math.random() > 0.5 ? "meaning" : "reading");
      }
    } catch (e) {
      console.error("Failed to submit grade:", e);
    } finally {
      setSubmitting(false);
    }
  };

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
    fetchStats();
  };

  const handleEndSessionEarly = useCallback(() => {
    if (sessionId && queue.length > 0) completeSession();
    // completeSession is stable in practice (same sessionId for the run)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, queue.length]);

  const isFullScreen = phase === "reviewing" || phase === "summary";

  return (
    <>
      {/* Setup: normal in-page layout */}
      {phase === "setup" && (
        <div className="relative min-h-[60vh]">
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
          {loading && (
            <div className="max-w-lg mx-auto space-y-4">
              <div className="h-8 bg-secondary animate-pulse rounded-lg w-48 mx-auto" />
              <div className="h-40 bg-secondary animate-pulse rounded-2xl" />
              <div className="h-12 bg-secondary animate-pulse rounded-lg" />
            </div>
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
            className="fixed inset-0 z-[100] flex flex-col bg-background"
          >
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

            {phase === "reviewing" && queue.length > 0 && (
              <>
                {/* Minimal header: exit + progress only */}
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
                      <span className="font-mono">{currentIndex}</span>
                      <span className="opacity-50">/</span>
                      <span className="font-mono">{queue.length}</span>
                    </span>
                    <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden hidden sm:block">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={false}
                        animate={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </header>

                <div className="flex-1 flex flex-col min-h-0 overflow-auto">
                  <div className="flex-1 flex items-center justify-center p-6">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key="reviewing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        className="w-full max-w-2xl mx-auto"
                      >
                        <ReviewCard
                          item={queue[currentIndex]}
                          index={currentIndex}
                          total={queue.length}
                          questionType={questionType}
                          consecutiveCorrect={consecutiveCorrect}
                          onGrade={handleGrade}
                          disabled={submitting}
                          fullScreen
                        />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </>
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
                  />
                </motion.div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
