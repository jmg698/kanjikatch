/**
 * Modified SM-2 Spaced Repetition Algorithm for KanjiKatch.
 *
 * Grade mapping (user-facing → SM-2 quality):
 *   Again → 1  (wrong, reset)
 *   Hard  → 3  (correct but struggled)
 *   Good  → 4  (solid recall)
 *   Easy  → 5  (instant, effortless)
 */

export type Grade = "again" | "hard" | "good" | "easy";
export type ConfidenceLevel = "new" | "learning" | "reviewing" | "known";

export interface SrsState {
  intervalDays: number;
  easeFactor: number;
  reviewCount: number;
  timesCorrect: number;
  confidenceLevel: ConfidenceLevel;
}

export interface SrsUpdate extends SrsState {
  nextReviewAt: Date;
  lastReviewedAt: Date;
}

export interface GradeOption {
  grade: Grade;
  quality: number;
  nextIntervalDays: number;
  xp: number;
  label: string;
}

const GRADE_TO_QUALITY: Record<Grade, number> = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
};

const MIN_EASE_FACTOR = 1.3;
const STARTING_EASE_FACTOR = 2.5;

const LEARNING_STEPS = [1, 3]; // days for new items: 1d → 3d → SM-2

function clampEase(ef: number): number {
  return Math.max(MIN_EASE_FACTOR, Math.round(ef * 100) / 100);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Calculate the next interval for a given grade, WITHOUT mutating anything.
 * Used both for the actual update and for previewing intervals on grade buttons.
 */
export function calculateNextInterval(
  grade: Grade,
  current: SrsState,
): { intervalDays: number; easeFactor: number } {
  const quality = GRADE_TO_QUALITY[grade];
  let { intervalDays, easeFactor, reviewCount } = current;

  if (quality < 3) {
    // Wrong — reset to 1 day, penalize ease
    return {
      intervalDays: 1,
      easeFactor: clampEase(easeFactor - 0.2),
    };
  }

  // Correct answer
  const newEase = clampEase(
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  // Learning sequence for new/early items
  if (reviewCount < LEARNING_STEPS.length) {
    const stepInterval = LEARNING_STEPS[reviewCount];
    const multiplier = grade === "easy" ? 2 : grade === "hard" ? 1 : 1;
    return {
      intervalDays: stepInterval * multiplier,
      easeFactor: newEase,
    };
  }

  // SM-2 graduated items
  let newInterval: number;
  if (intervalDays === 0) {
    newInterval = 1;
  } else if (intervalDays === 1) {
    newInterval = 6;
  } else {
    newInterval = Math.round(intervalDays * newEase);
  }

  if (grade === "hard") {
    newInterval = Math.max(Math.round(newInterval * 0.8), intervalDays + 1);
  } else if (grade === "easy") {
    newInterval = Math.round(newInterval * 1.3);
  }

  return {
    intervalDays: Math.max(1, newInterval),
    easeFactor: newEase,
  };
}

/**
 * Determine the confidence level based on review history.
 */
function computeConfidence(
  reviewCount: number,
  timesCorrect: number,
  intervalDays: number,
  wasCorrect: boolean,
): ConfidenceLevel {
  if (reviewCount === 0) return "new";
  if (!wasCorrect) {
    return reviewCount <= 2 ? "learning" : "reviewing";
  }
  if (intervalDays > 21 && timesCorrect > 0) {
    const accuracy = timesCorrect / reviewCount;
    if (accuracy >= 0.85) return "known";
  }
  if (timesCorrect >= 3) return "reviewing";
  return "learning";
}

/**
 * Process a review and produce the full SRS update to apply to the item.
 */
export function processReview(
  grade: Grade,
  current: SrsState,
  now: Date = new Date(),
): SrsUpdate {
  const wasCorrect = GRADE_TO_QUALITY[grade] >= 3;
  const { intervalDays, easeFactor } = calculateNextInterval(grade, current);

  const newReviewCount = current.reviewCount + 1;
  const newTimesCorrect = current.timesCorrect + (wasCorrect ? 1 : 0);

  return {
    intervalDays,
    easeFactor,
    reviewCount: newReviewCount,
    timesCorrect: newTimesCorrect,
    confidenceLevel: computeConfidence(newReviewCount, newTimesCorrect, intervalDays, wasCorrect),
    nextReviewAt: addDays(now, intervalDays),
    lastReviewedAt: now,
  };
}

/**
 * Build the four grade button options with their preview intervals and XP.
 * Displayed on the answer side of the review card.
 */
export function getGradeOptions(current: SrsState, streakBonus: number = 0): GradeOption[] {
  const grades: Grade[] = ["again", "hard", "good", "easy"];
  return grades.map((grade) => {
    const { intervalDays } = calculateNextInterval(grade, current);
    return {
      grade,
      quality: GRADE_TO_QUALITY[grade],
      nextIntervalDays: intervalDays,
      xp: calculateXp(grade, streakBonus),
      label: formatInterval(intervalDays),
    };
  });
}

// ── XP System ──────────────────────────────────────────

const XP_REWARDS: Record<Grade, number> = {
  again: 2,
  hard: 10,
  good: 10,
  easy: 15,
};

const XP_PER_LEVEL = 500;
const SESSION_COMPLETION_XP = 25;

export function calculateXp(grade: Grade, streakBonus: number = 0): number {
  const base = XP_REWARDS[grade];
  const bonus = GRADE_TO_QUALITY[grade] >= 3 ? streakBonus * 2 : 0;
  return base + bonus;
}

export function calculateLevel(totalXp: number): { level: number; xpInLevel: number; xpForNext: number } {
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpInLevel = totalXp % XP_PER_LEVEL;
  return { level, xpInLevel, xpForNext: XP_PER_LEVEL };
}

export function getSessionCompletionXp(): number {
  return SESSION_COMPLETION_XP;
}

export function getLevelTitle(level: number): string {
  if (level <= 5) return "初心者"; // Beginner
  if (level <= 10) return "学生"; // Student
  if (level <= 20) return "読者"; // Reader
  if (level <= 35) return "達人"; // Expert
  return "先生"; // Master
}

// ── Formatting Helpers ─────────────────────────────────

export function formatInterval(days: number): string {
  if (days < 1) return "<1d";
  if (days === 1) return "1d";
  if (days < 30) return `${days}d`;
  if (days < 365) {
    const months = Math.round(days / 30);
    return `${months}mo`;
  }
  const years = (days / 365).toFixed(1);
  return `${years}y`;
}

// ── Streak Helpers ─────────────────────────────────────

/**
 * Given the last review date string (YYYY-MM-DD) and today's date string,
 * return the updated streak values.
 */
export function updateStreak(
  lastReviewDate: string | null,
  currentStreak: number,
  longestStreak: number,
  todayStr: string,
): { currentStreak: number; longestStreak: number } {
  if (!lastReviewDate || lastReviewDate === "") {
    return { currentStreak: 1, longestStreak: Math.max(longestStreak, 1) };
  }

  if (lastReviewDate === todayStr) {
    return { currentStreak, longestStreak };
  }

  const last = new Date(lastReviewDate + "T00:00:00Z");
  const today = new Date(todayStr + "T00:00:00Z");
  const diffMs = today.getTime() - last.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    const newStreak = currentStreak + 1;
    return { currentStreak: newStreak, longestStreak: Math.max(longestStreak, newStreak) };
  }

  // Streak broken (missed a day or more)
  return { currentStreak: 1, longestStreak: Math.max(longestStreak, currentStreak) };
}

export function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}
