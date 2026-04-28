export type SessionType = "kanji" | "vocab" | "mixed";

export interface QueueEntry {
  item: ReviewQueueItem;
  isRetry: boolean;
  retryReason?: "missed" | "hard";
  entryId: number;
}

export type RequeueTier = "again" | "hard";

export interface RequeueState {
  tier: RequeueTier;
  consecutiveCorrect: number;
  requiredCorrect: number;
}

export interface ReviewQueueItem {
  id: string;
  trackId: string;
  type: "kanji" | "vocab";
  questionType: "meaning" | "reading";
  prompt: string;
  readings: string[];
  readingsKun?: string[];
  meanings: string[];
  partOfSpeech?: string | null;
  kanjiDetails?: { character: string; meanings: string[] }[];
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

export interface PriorTrackState {
  intervalDays: number;
  easeFactor: string;
  reviewCount: number;
  timesCorrect: number;
  confidenceLevel: string;
  nextReviewAt: string | null;
  lastReviewedAt: string | null;
}

export interface UndoSnapshot {
  // Queue/state to restore
  prevQueue: QueueEntry[];
  prevCurrentIndex: number;
  prevConsecutiveCorrect: number;
  prevTotalXpEarned: number;
  prevRequeueState: RequeueState | null;
  // Server-side reversal info (only present for first-appearance grades)
  isRetry: boolean;
  trackId: string;
  historyId?: string;
  serverTrackId?: string;
  priorTrackState?: PriorTrackState;
  xpEarned: number;
}
