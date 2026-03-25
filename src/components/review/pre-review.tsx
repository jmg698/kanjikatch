"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, Zap, BookOpen, Languages } from "lucide-react";
import type { DueCounts, ReviewStats, SessionType } from "./review-types";

interface PreReviewProps {
  dueCounts: DueCounts;
  stats: ReviewStats | null;
  onStart: (type: SessionType, size: number) => void;
  loading: boolean;
}

const SESSION_SIZES: (number | "all")[] = [5, 15, 25, 50, "all"];

export function PreReview({ dueCounts, stats, onStart, loading }: PreReviewProps) {
  const sessionType: SessionType = "mixed";
  const [sessionSize, setSessionSize] = useState<number | "all">(15);

  const hasDueItems = dueCounts.total > 0;
  const effectiveSize = sessionSize === "all" ? dueCounts.total : Math.min(sessionSize, dueCounts.total);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Streak & Level Banner */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-6 text-sm"
        >
          {stats.currentStreak > 0 && (
            <div className="flex items-center gap-1.5 text-orange-500 font-semibold">
              <Flame className="h-5 w-5" />
              <span>{stats.currentStreak} day streak</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-primary font-semibold">
            <Zap className="h-5 w-5" />
            <span>Lv. {stats.level} {stats.levelTitle}</span>
          </div>
        </motion.div>
      )}

      {/* Due Items Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="jr-panel overflow-hidden">
          <CardHeader className="pb-3 text-center">
            <CardTitle className="text-2xl">
              {hasDueItems ? (
                <>
                  <span className="text-4xl font-mono font-bold text-primary block mb-1">
                    {dueCounts.total}
                  </span>
                  items ready for review
                </>
              ) : (
                "All caught up!"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {hasDueItems ? (
              <div className="flex justify-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  {dueCounts.kanji} kanji
                </span>
                <span className="flex items-center gap-1">
                  <Languages className="h-4 w-4" />
                  {dueCounts.vocab} vocab
                </span>
              </div>
            ) : (
              <p className="text-center text-muted-foreground text-sm">
                Great work! Check back later for more reviews.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {hasDueItems && (
        <>
          {/* Session Size */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <label className="text-sm font-medium text-muted-foreground block text-center">
              Session Size
            </label>
            <div className="flex justify-center gap-2">
              {SESSION_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => setSessionSize(size)}
                  className={`
                    px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all
                    ${size === "all" ? "" : "font-mono"}
                    ${sessionSize === size
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/30 text-muted-foreground"
                    }
                  `}
                >
                  {size === "all" ? "All" : size}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Start Button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              onClick={() => onStart(sessionType, effectiveSize)}
              disabled={loading || effectiveSize === 0}
              size="lg"
              className="w-full h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              {loading ? "Loading..." : `Start Review (${effectiveSize} items)`}
            </Button>
          </motion.div>

          {/* Daily Progress */}
          {stats && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-center text-sm text-muted-foreground"
            >
              Today: {stats.dailyReviewsToday} / {stats.dailyGoal} daily goal
              <div className="mt-1 mx-auto max-w-xs h-2 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (stats.dailyReviewsToday / stats.dailyGoal) * 100)}%` }}
                  transition={{ delay: 0.6, duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
