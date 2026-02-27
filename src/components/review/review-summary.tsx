"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, Zap, Trophy, ArrowRight, RotateCcw, Target, Clock, CheckCircle2 } from "lucide-react";
import type { SessionSummary, ReviewStats } from "./review-types";

interface ReviewSummaryProps {
  summary: SessionSummary;
  stats: ReviewStats | null;
  leveledUp: boolean;
  previousLevel: number;
  onReviewAgain: () => void;
  onBackToDashboard: () => void;
}

function AnimatedNumber({ value, duration = 1 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = (now - start) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <>{display}</>;
}

function getEncouragingMessage(accuracy: number): string {
  if (accuracy >= 95) return "Outstanding! Nearly perfect!";
  if (accuracy >= 90) return "Excellent work! You're crushing it!";
  if (accuracy >= 80) return "Great session! Keep it up!";
  if (accuracy >= 70) return "Nice effort! You're making progress!";
  if (accuracy >= 50) return "Good practice! Every review helps!";
  return "Keep going! Practice makes progress!";
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

export function ReviewSummary({
  summary,
  stats,
  leveledUp,
  previousLevel,
  onReviewAgain,
  onBackToDashboard,
}: ReviewSummaryProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (leveledUp || summary.accuracy >= 90) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [leveledUp, summary.accuracy]);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Confetti-like particles for celebrations */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-3 rounded-full"
              style={{
                backgroundColor: ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"][i % 5],
                left: `${10 + Math.random() * 80}%`,
              }}
              initial={{ y: -20, opacity: 1, scale: 0 }}
              animate={{
                y: window.innerHeight + 20,
                opacity: [1, 1, 0],
                scale: [0, 1, 0.5],
                x: (Math.random() - 0.5) * 200,
                rotate: Math.random() * 720,
              }}
              transition={{
                duration: 1.5 + Math.random(),
                delay: Math.random() * 0.5,
                ease: "easeOut",
              }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-2"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
        >
          <CheckCircle2 className="h-16 w-16 mx-auto text-primary" />
        </motion.div>
        <h2 className="text-2xl font-bold">Session Complete!</h2>
        <p className="text-muted-foreground">{getEncouragingMessage(summary.accuracy)}</p>
      </motion.div>

      {/* Level Up Celebration */}
      {leveledUp && stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="jr-panel border-primary/30 bg-primary/5">
            <CardContent className="py-6 text-center">
              <Trophy className="h-10 w-10 mx-auto mb-2 text-primary" />
              <h3 className="text-xl font-bold text-primary">Level Up!</h3>
              <p className="text-lg font-mono">
                Lv. {previousLevel} → Lv. {stats.level}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{stats.levelTitle}</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="jr-panel">
          <CardContent className="py-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <Target className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <div className="text-3xl font-mono font-bold">
                  <AnimatedNumber value={summary.accuracy} />%
                </div>
                <span className="text-xs text-muted-foreground">Accuracy</span>
              </div>
              <div className="text-center">
                <Zap className="h-5 w-5 mx-auto mb-1 text-primary" />
                <div className="text-3xl font-mono font-bold text-primary">
                  +<AnimatedNumber value={summary.xpEarned} />
                </div>
                <span className="text-xs text-muted-foreground">XP Earned</span>
              </div>
              <div className="text-center">
                <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
                <div className="text-2xl font-mono font-bold">
                  {summary.itemsCorrect}/{summary.itemsReviewed}
                </div>
                <span className="text-xs text-muted-foreground">Correct</span>
              </div>
              <div className="text-center">
                <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <div className="text-2xl font-mono font-bold">
                  {formatDuration(summary.durationMs)}
                </div>
                <span className="text-xs text-muted-foreground">Duration</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* XP & Level Progress */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="jr-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Level {stats.level} · {stats.levelTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="h-3 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(stats.xpInLevel / stats.xpForNext) * 100}%` }}
                  transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {stats.xpInLevel} / {stats.xpForNext} XP
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Streak */}
      {stats && stats.currentStreak > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex items-center justify-center gap-2 text-orange-500 font-semibold"
        >
          <Flame className="h-5 w-5" />
          <span>{stats.currentStreak} day streak!</span>
        </motion.div>
      )}

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="flex flex-col gap-3"
      >
        <Button onClick={onReviewAgain} size="lg" className="w-full h-12">
          <RotateCcw className="h-4 w-4 mr-2" />
          Review Again
        </Button>
        <Button onClick={onBackToDashboard} variant="outline" size="lg" className="w-full h-12">
          Back to Dashboard
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </motion.div>
    </div>
  );
}
