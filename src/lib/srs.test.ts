import { describe, it, expect } from "vitest";
import {
  calculateNextInterval,
  processReview,
  getGradeOptions,
  calculateXp,
  calculateLevel,
  getLevelTitle,
  updateStreak,
  formatInterval,
  type SrsState,
} from "./srs";

const freshItem: SrsState = {
  intervalDays: 1,
  easeFactor: 2.5,
  reviewCount: 0,
  timesCorrect: 0,
  confidenceLevel: "new",
};

describe("calculateNextInterval", () => {
  it("resets interval to 1 day on Again", () => {
    const result = calculateNextInterval("again", freshItem);
    expect(result.intervalDays).toBe(1);
    expect(result.easeFactor).toBeLessThan(2.5);
  });

  it("follows learning steps for new items", () => {
    const result = calculateNextInterval("good", freshItem);
    expect(result.intervalDays).toBe(1); // first learning step
  });

  it("advances to second learning step", () => {
    const afterFirst: SrsState = { ...freshItem, reviewCount: 1, timesCorrect: 1 };
    const result = calculateNextInterval("good", afterFirst);
    expect(result.intervalDays).toBe(3); // second learning step
  });

  it("graduates to SM-2 after learning steps", () => {
    const graduated: SrsState = {
      intervalDays: 3,
      easeFactor: 2.5,
      reviewCount: 2,
      timesCorrect: 2,
      confidenceLevel: "learning",
    };
    const result = calculateNextInterval("good", graduated);
    expect(result.intervalDays).toBeGreaterThan(3);
  });

  it("never drops ease below 1.3", () => {
    const lowEase: SrsState = {
      intervalDays: 1,
      easeFactor: 1.3,
      reviewCount: 5,
      timesCorrect: 0,
      confidenceLevel: "learning",
    };
    const result = calculateNextInterval("again", lowEase);
    expect(result.easeFactor).toBe(1.3);
  });

  it("Easy gives longer intervals than Good", () => {
    const item: SrsState = {
      intervalDays: 10,
      easeFactor: 2.5,
      reviewCount: 5,
      timesCorrect: 5,
      confidenceLevel: "reviewing",
    };
    const easyResult = calculateNextInterval("easy", item);
    const goodResult = calculateNextInterval("good", item);
    expect(easyResult.intervalDays).toBeGreaterThan(goodResult.intervalDays);
  });

  it("Hard gives shorter intervals than Good", () => {
    const item: SrsState = {
      intervalDays: 10,
      easeFactor: 2.5,
      reviewCount: 5,
      timesCorrect: 5,
      confidenceLevel: "reviewing",
    };
    const hardResult = calculateNextInterval("hard", item);
    const goodResult = calculateNextInterval("good", item);
    expect(hardResult.intervalDays).toBeLessThan(goodResult.intervalDays);
  });

  it("interval always at least 1 day", () => {
    const result = calculateNextInterval("again", freshItem);
    expect(result.intervalDays).toBeGreaterThanOrEqual(1);
  });
});

describe("processReview", () => {
  const now = new Date("2026-02-27T10:00:00Z");

  it("returns complete SRS update", () => {
    const update = processReview("good", freshItem, now);
    expect(update.nextReviewAt).toBeInstanceOf(Date);
    expect(update.lastReviewedAt).toEqual(now);
    expect(update.reviewCount).toBe(1);
    expect(update.timesCorrect).toBe(1);
  });

  it("increments timesCorrect only on correct answers", () => {
    const correct = processReview("good", freshItem, now);
    expect(correct.timesCorrect).toBe(1);

    const wrong = processReview("again", freshItem, now);
    expect(wrong.timesCorrect).toBe(0);
  });

  it("transitions new → learning on first review", () => {
    const update = processReview("good", freshItem, now);
    expect(update.confidenceLevel).toBe("learning");
  });

  it("transitions to reviewing after 3+ correct", () => {
    const item: SrsState = {
      intervalDays: 6,
      easeFactor: 2.5,
      reviewCount: 3,
      timesCorrect: 2,
      confidenceLevel: "learning",
    };
    const update = processReview("good", item, now);
    expect(update.confidenceLevel).toBe("reviewing");
  });

  it("transitions to known with high accuracy and long interval", () => {
    const item: SrsState = {
      intervalDays: 20,
      easeFactor: 2.5,
      reviewCount: 19,
      timesCorrect: 18,
      confidenceLevel: "reviewing",
    };
    const update = processReview("easy", item, now);
    // interval > 21 and accuracy 19/20 = 95% > 85%
    expect(update.confidenceLevel).toBe("known");
  });

  it("sets nextReviewAt in the future", () => {
    const update = processReview("good", freshItem, now);
    expect(update.nextReviewAt.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("getGradeOptions", () => {
  it("returns 4 options", () => {
    const options = getGradeOptions(freshItem);
    expect(options).toHaveLength(4);
    expect(options.map((o) => o.grade)).toEqual(["again", "hard", "good", "easy"]);
  });

  it("includes XP for each grade", () => {
    const options = getGradeOptions(freshItem);
    expect(options[0].xp).toBe(2); // again
    expect(options[2].xp).toBe(10); // good
    expect(options[3].xp).toBe(15); // easy
  });

  it("includes streak bonus in XP for correct answers", () => {
    const withStreak = getGradeOptions(freshItem, 3);
    const noStreak = getGradeOptions(freshItem, 0);
    expect(withStreak[2].xp).toBeGreaterThan(noStreak[2].xp); // good with streak
    expect(withStreak[0].xp).toBe(noStreak[0].xp); // again doesn't get streak bonus
  });

  it("labels are human-readable intervals", () => {
    const options = getGradeOptions(freshItem);
    options.forEach((o) => {
      expect(o.label).toMatch(/^\d+[dmy]|<1d|[\d.]+y$/);
    });
  });
});

describe("calculateXp", () => {
  it("again gives 2 XP regardless of streak", () => {
    expect(calculateXp("again", 0)).toBe(2);
    expect(calculateXp("again", 5)).toBe(2);
  });

  it("good gives 10 base + streak bonus", () => {
    expect(calculateXp("good", 0)).toBe(10);
    expect(calculateXp("good", 3)).toBe(16); // 10 + 3*2
  });

  it("easy gives 15 base + streak bonus", () => {
    expect(calculateXp("easy", 0)).toBe(15);
    expect(calculateXp("easy", 2)).toBe(19); // 15 + 2*2
  });
});

describe("calculateLevel", () => {
  it("level 1 at 0 XP", () => {
    const { level, xpInLevel } = calculateLevel(0);
    expect(level).toBe(1);
    expect(xpInLevel).toBe(0);
  });

  it("level 2 at 500 XP", () => {
    const { level } = calculateLevel(500);
    expect(level).toBe(2);
  });

  it("calculates xp within level correctly", () => {
    const { level, xpInLevel, xpForNext } = calculateLevel(750);
    expect(level).toBe(2);
    expect(xpInLevel).toBe(250);
    expect(xpForNext).toBe(500);
  });
});

describe("getLevelTitle", () => {
  it("returns Japanese titles by level range", () => {
    expect(getLevelTitle(1)).toBe("初心者");
    expect(getLevelTitle(5)).toBe("初心者");
    expect(getLevelTitle(6)).toBe("学生");
    expect(getLevelTitle(11)).toBe("読者");
    expect(getLevelTitle(21)).toBe("達人");
    expect(getLevelTitle(36)).toBe("先生");
  });
});

describe("updateStreak", () => {
  it("starts streak at 1 when no previous date", () => {
    const result = updateStreak(null, 0, 0, "2026-02-27");
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
  });

  it("maintains streak on same day", () => {
    const result = updateStreak("2026-02-27", 3, 5, "2026-02-27");
    expect(result.currentStreak).toBe(3);
  });

  it("increments streak on consecutive day", () => {
    const result = updateStreak("2026-02-26", 3, 5, "2026-02-27");
    expect(result.currentStreak).toBe(4);
    expect(result.longestStreak).toBe(5);
  });

  it("updates longest streak when current exceeds it", () => {
    const result = updateStreak("2026-02-26", 5, 5, "2026-02-27");
    expect(result.currentStreak).toBe(6);
    expect(result.longestStreak).toBe(6);
  });

  it("resets streak after missing a day", () => {
    const result = updateStreak("2026-02-25", 5, 10, "2026-02-27");
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(10);
  });
});

describe("formatInterval", () => {
  it("formats days", () => {
    expect(formatInterval(1)).toBe("1d");
    expect(formatInterval(7)).toBe("7d");
    expect(formatInterval(29)).toBe("29d");
  });

  it("formats months", () => {
    expect(formatInterval(30)).toBe("1mo");
    expect(formatInterval(60)).toBe("2mo");
  });

  it("formats years", () => {
    expect(formatInterval(365)).toBe("1.0y");
  });
});
