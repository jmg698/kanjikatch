export type SessionType = "kanji" | "vocab" | "mixed";

export interface ReviewQueueItem {
  id: string;
  type: "kanji" | "vocab";
  prompt: string;
  readings: string[];
  readingsKun?: string[];
  meanings: string[];
  partOfSpeech?: string | null;
  jlptLevel: number | null;
  firstSeenAt: string;
  timesSeen: number;
  sourceImageIds: string[];
  reviewCount: number;
  confidenceLevel: string;
  intervalDays: number;
  easeFactor: string;
  timesCorrect: number;
  nextReviewAt: string | null;
  sourceImageUrl?: string | null;
}

export interface DueCounts {
  kanji: number;
  vocab: number;
  total: number;
}

export interface SessionSummary {
  sessionId: string;
  itemsReviewed: number;
  itemsCorrect: number;
  accuracy: number;
  xpEarned: number;
  durationMs: number;
  completedAt: string;
}

export interface ReviewStats {
  currentStreak: number;
  longestStreak: number;
  totalReviews: number;
  totalCorrect: number;
  accuracy: number;
  xp: number;
  level: number;
  levelTitle: string;
  xpInLevel: number;
  xpForNext: number;
  dailyGoal: number;
  dailyReviewsToday: number;
}
