import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, BookOpen, GraduationCap, Flame, Zap, Target, TrendingUp, BarChart3 } from "lucide-react";
import { db, kanji, vocabulary, sentences, userStats, reviewSessions } from "@/db";
import { getCurrentUserId } from "@/lib/auth";
import { eq, and, or, lte, isNull, desc, sql, gte, lt } from "drizzle-orm";
import { calculateLevel, getLevelTitle } from "@/lib/srs";

async function getDashboardData(userId: string) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const [
    [kanjiCount],
    [vocabCount],
    [sentenceCount],
    [kanjiDue],
    [vocabDue],
    stats,
    kanjiConfidence,
    vocabConfidence,
    recentSessions,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(kanji).where(eq(kanji.userId, userId)),
    db.select({ count: sql<number>`count(*)::int` }).from(vocabulary).where(eq(vocabulary.userId, userId)),
    db.select({ count: sql<number>`count(*)::int` }).from(sentences).where(eq(sentences.userId, userId)),
    db.select({ count: sql<number>`count(*)::int` }).from(kanji).where(
      and(eq(kanji.userId, userId), or(lte(kanji.nextReviewAt, now), isNull(kanji.nextReviewAt)))
    ),
    db.select({ count: sql<number>`count(*)::int` }).from(vocabulary).where(
      and(eq(vocabulary.userId, userId), or(lte(vocabulary.nextReviewAt, now), isNull(vocabulary.nextReviewAt)))
    ),
    db.select().from(userStats).where(eq(userStats.userId, userId)).then((r) => r[0] ?? null),
    db.select({ level: kanji.confidenceLevel, count: sql<number>`count(*)::int` })
      .from(kanji).where(eq(kanji.userId, userId)).groupBy(kanji.confidenceLevel),
    db.select({ level: vocabulary.confidenceLevel, count: sql<number>`count(*)::int` })
      .from(vocabulary).where(eq(vocabulary.userId, userId)).groupBy(vocabulary.confidenceLevel),
    db.select().from(reviewSessions).where(eq(reviewSessions.userId, userId))
      .orderBy(desc(reviewSessions.startedAt)).limit(5),
  ]);

  // Forecast: next 7 days
  const forecast: { date: string; count: number; label: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    let condition;
    if (i === 0) {
      condition = and(
        eq(kanji.userId, userId),
        or(lte(kanji.nextReviewAt, dayEnd), isNull(kanji.nextReviewAt)),
      );
    } else {
      condition = and(
        eq(kanji.userId, userId),
        gte(kanji.nextReviewAt, dayStart),
        lt(kanji.nextReviewAt, dayEnd),
      );
    }

    let vocabCondition;
    if (i === 0) {
      vocabCondition = and(
        eq(vocabulary.userId, userId),
        or(lte(vocabulary.nextReviewAt, dayEnd), isNull(vocabulary.nextReviewAt)),
      );
    } else {
      vocabCondition = and(
        eq(vocabulary.userId, userId),
        gte(vocabulary.nextReviewAt, dayStart),
        lt(vocabulary.nextReviewAt, dayEnd),
      );
    }

    const [kc] = await db.select({ count: sql<number>`count(*)::int` }).from(kanji).where(condition);
    const [vc] = await db.select({ count: sql<number>`count(*)::int` }).from(vocabulary).where(vocabCondition);

    const dayLabel = i === 0 ? "Today" : dayStart.toLocaleDateString("en-US", { weekday: "short" });
    forecast.push({ date: dayStart.toISOString().slice(0, 10), count: kc.count + vc.count, label: dayLabel });
  }

  const totalDue = kanjiDue.count + vocabDue.count;
  const xp = stats?.xp ?? 0;
  const levelInfo = calculateLevel(xp);
  const dailyToday = stats?.dailyReviewsDate === todayStr ? (stats?.dailyReviewsToday ?? 0) : 0;

  return {
    counts: { kanji: kanjiCount.count, vocab: vocabCount.count, sentences: sentenceCount.count },
    due: { kanji: kanjiDue.count, vocab: vocabDue.count, total: totalDue },
    stats: stats ? {
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      totalReviews: stats.totalReviews,
      totalCorrect: stats.totalCorrect,
      accuracy: stats.totalReviews > 0 ? Math.round((stats.totalCorrect / stats.totalReviews) * 100) : 0,
      xp,
      level: levelInfo.level,
      levelTitle: getLevelTitle(levelInfo.level),
      xpInLevel: levelInfo.xpInLevel,
      xpForNext: levelInfo.xpForNext,
      dailyGoal: stats.dailyGoal,
      dailyToday,
    } : null,
    confidence: {
      kanji: Object.fromEntries(kanjiConfidence.map((c) => [c.level, c.count])) as Record<string, number>,
      vocab: Object.fromEntries(vocabConfidence.map((c) => [c.level, c.count])) as Record<string, number>,
    },
    forecast,
    recentSessions,
  };
}

const CONFIDENCE_COLORS: Record<string, { bg: string; label: string }> = {
  new: { bg: "bg-gray-300", label: "New" },
  learning: { bg: "bg-amber-400", label: "Learning" },
  reviewing: { bg: "bg-blue-400", label: "Reviewing" },
  known: { bg: "bg-emerald-500", label: "Known" },
};

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  const data = await getDashboardData(userId);

  const maxForecast = Math.max(...data.forecast.map((f) => f.count), 1);

  return (
    <div className="space-y-8">
      {/* Review CTA — Most Prominent */}
      {data.due.total > 0 ? (
        <Card className="jr-panel border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <h2 className="text-2xl font-bold">
                  <span className="text-primary font-mono">{data.due.total}</span> items ready for review
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {data.due.kanji} kanji · {data.due.vocab} vocabulary
                </p>
              </div>
              <Button asChild size="lg" className="h-12 px-8 text-lg font-semibold shadow-lg">
                <Link href="/review">
                  <GraduationCap className="h-5 w-5 mr-2" />
                  Start Review
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="jr-panel">
          <CardContent className="py-6 text-center">
            <GraduationCap className="h-10 w-10 mx-auto mb-2 text-primary/50" />
            <h2 className="text-xl font-semibold">All caught up!</h2>
            <p className="text-sm text-muted-foreground">No items due for review right now.</p>
          </CardContent>
        </Card>
      )}

      {/* Stats Row */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {data.stats && data.stats.currentStreak > 0 && (
          <Card className="jr-panel">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-wider flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                Streak
              </CardDescription>
              <CardTitle className="text-3xl font-mono font-bold text-orange-500">
                {data.stats.currentStreak}
              </CardTitle>
            </CardHeader>
          </Card>
        )}

        <Card className="jr-panel">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Level
            </CardDescription>
            <CardTitle className="text-3xl font-mono font-bold text-primary">
              {data.stats?.level ?? 1}
            </CardTitle>
            {data.stats && (
              <p className="text-xs text-muted-foreground">{data.stats.levelTitle}</p>
            )}
          </CardHeader>
        </Card>

        <Card className="jr-panel">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              Total Kanji
            </CardDescription>
            <CardTitle className="text-3xl font-mono font-bold">{data.counts.kanji}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="jr-panel">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              Total Vocab
            </CardDescription>
            <CardTitle className="text-3xl font-mono font-bold">{data.counts.vocab}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* XP Progress + Daily Goal */}
      {data.stats && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="jr-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                XP Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-mono font-bold">{data.stats.xp}</span>
                <span className="text-sm text-muted-foreground">total XP</span>
              </div>
              <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(data.stats.xpInLevel / data.stats.xpForNext) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.stats.xpInLevel} / {data.stats.xpForNext} XP to level {data.stats.level + 1}
              </p>
            </CardContent>
          </Card>

          <Card className="jr-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" />
                Daily Goal
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-mono font-bold">{data.stats.dailyToday}</span>
                <span className="text-sm text-muted-foreground">/ {data.stats.dailyGoal} reviews</span>
              </div>
              <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (data.stats.dailyToday / data.stats.dailyGoal) * 100)}%` }}
                />
              </div>
              {data.stats.dailyToday >= data.stats.dailyGoal ? (
                <p className="text-xs text-emerald-600 font-medium mt-1">Goal complete!</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  {data.stats.dailyGoal - data.stats.dailyToday} more to hit your goal
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Forecast + Knowledge Strength */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* 7-Day Forecast */}
        <Card className="jr-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Review Forecast
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex items-end gap-1.5 h-24">
              {data.forecast.map((day, i) => (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-mono text-muted-foreground">{day.count || ""}</span>
                  <div
                    className={`w-full rounded-t transition-all ${
                      i === 0 ? "bg-primary" : "bg-primary/30"
                    }`}
                    style={{ height: `${Math.max(4, (day.count / maxForecast) * 80)}px` }}
                  />
                  <span className={`text-[10px] ${i === 0 ? "font-bold text-primary" : "text-muted-foreground"}`}>
                    {day.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Knowledge Strength */}
        <Card className="jr-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Knowledge Strength
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-3">
            {(["kanji", "vocab"] as const).map((type) => {
              const conf = type === "kanji" ? data.confidence.kanji : data.confidence.vocab;
              const total = Object.values(conf).reduce((a, b) => a + b, 0);
              if (total === 0) return null;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium capitalize">{type}</span>
                    <span className="text-xs text-muted-foreground">{total} items</span>
                  </div>
                  <div className="h-3 bg-secondary rounded-full overflow-hidden flex">
                    {(["known", "reviewing", "learning", "new"] as const).map((level) => {
                      const count = conf[level] || 0;
                      if (count === 0) return null;
                      const width = (count / total) * 100;
                      const color = CONFIDENCE_COLORS[level];
                      return (
                        <div
                          key={level}
                          className={`h-full ${color.bg} first:rounded-l-full last:rounded-r-full`}
                          style={{ width: `${width}%` }}
                          title={`${color.label}: ${count}`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-3 pt-1">
              {Object.entries(CONFIDENCE_COLORS).map(([key, { bg, label }]) => (
                <div key={key} className="flex items-center gap-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${bg}`} />
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="jr-panel hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <Camera className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Capture New</CardTitle>
            <CardDescription>
              Upload a photo of your notes or learning materials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/capture">Start Capture</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="jr-panel hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <BookOpen className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Your Library</CardTitle>
            <CardDescription>
              Browse your kanji, vocabulary, and sentences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/library">View Library</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Lifetime Accuracy */}
      {data.stats && data.stats.totalReviews > 0 && (
        <Card className="jr-panel">
          <CardContent className="py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Lifetime accuracy</span>
              <span className="font-mono font-semibold">{data.stats.accuracy}%</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-muted-foreground">Total reviews</span>
              <span className="font-mono font-semibold">{data.stats.totalReviews}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
