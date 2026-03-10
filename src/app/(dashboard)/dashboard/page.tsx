import Link from "next/link";
import { Camera, BookOpen, Flame, Zap, Target, BarChart3 } from "lucide-react";
import { db, kanji, vocabulary, sentences, userStats, reviewSessions } from "@/db";
import { getCurrentUserId } from "@/lib/auth";
import { eq, and, or, lte, isNull, desc, sql, gte, lt } from "drizzle-orm";
import { calculateLevel, getLevelTitle } from "@/lib/srs";
import { XPBar, DailyRing } from "@/components/dashboard/progress-widgets";

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
    recentKanji,
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
    db.select({
      character: kanji.character,
      confidenceLevel: kanji.confidenceLevel,
      meanings: kanji.meanings,
    })
      .from(kanji)
      .where(eq(kanji.userId, userId))
      .orderBy(desc(kanji.firstSeenAt))
      .limit(20),
  ]);

  // 7-day review forecast
  const forecast: { date: string; count: number; label: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const kCond = i === 0
      ? and(eq(kanji.userId, userId), or(lte(kanji.nextReviewAt, dayEnd), isNull(kanji.nextReviewAt)))
      : and(eq(kanji.userId, userId), gte(kanji.nextReviewAt, dayStart), lt(kanji.nextReviewAt, dayEnd));

    const vCond = i === 0
      ? and(eq(vocabulary.userId, userId), or(lte(vocabulary.nextReviewAt, dayEnd), isNull(vocabulary.nextReviewAt)))
      : and(eq(vocabulary.userId, userId), gte(vocabulary.nextReviewAt, dayStart), lt(vocabulary.nextReviewAt, dayEnd));

    const [kc] = await db.select({ count: sql<number>`count(*)::int` }).from(kanji).where(kCond);
    const [vc] = await db.select({ count: sql<number>`count(*)::int` }).from(vocabulary).where(vCond);

    const dayLabel = i === 0 ? "今日" : dayStart.toLocaleDateString("ja-JP", { weekday: "short" });
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
    recentKanji,
  };
}

// SRS stage → WaniKani-style color dot
const SRS_DOT: Record<string, string> = {
  new: "srs-apprentice",
  learning: "srs-guru",
  reviewing: "srs-master",
  known: "srs-known",
};

const SRS_LABEL: Record<string, string> = {
  new: "Apprentice",
  learning: "Guru",
  reviewing: "Master",
  known: "Known",
};

const CONFIDENCE_COLORS: Record<string, { bg: string; label: string }> = {
  new: { bg: "bg-rose-400", label: "Apprentice" },
  learning: { bg: "bg-violet-500", label: "Guru" },
  reviewing: { bg: "bg-blue-500", label: "Master" },
  known: { bg: "bg-emerald-500", label: "Known" },
};

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  const data = await getDashboardData(userId);

  const maxForecast = Math.max(...data.forecast.map((f) => f.count), 1);
  const isNewUser = data.counts.kanji === 0 && data.counts.vocab === 0;

  return (
    <div className="space-y-5">

      {/* ── Hero Card ─────────────────────────────────────── */}
      <div className="dash-hero relative stagger-0">
        {/* Ghosted watermark character */}
        <span
          className="absolute text-[clamp(7rem,28vw,14rem)] font-serif leading-none select-none pointer-events-none"
          style={{
            color: 'hsl(25 20% 12% / 0.03)',
            top: '-8%',
            right: '2%',
            lineHeight: 1,
          }}
          aria-hidden
        >
          漢
        </span>

        <div className="relative z-10 px-6 py-8 sm:px-8 sm:py-10">
          {isNewUser ? (
            /* ── Welcome state ── */
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-medium">
                Welcome to KanjiKatch
              </p>
              <div className="border-t border-dashed border-border my-4 mx-auto max-w-[200px]" />
              <h2 className="text-3xl font-serif font-bold text-foreground leading-tight">
                はじめましょう
              </h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                Capture kanji from your study materials to begin your journey
              </p>
              <div className="flex justify-center mt-6">
                <Link href="/capture" className="start-review-cta">
                  <Camera className="h-5 w-5" />
                  Capture Kanji
                </Link>
              </div>
            </div>

          ) : data.due.total > 0 ? (
            /* ── Items due state ── */
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-medium">
                Ready for Review
              </p>
              <div className="border-t border-dashed border-border my-4 mx-auto max-w-[200px]" />

              <div className="py-2">
                <span className="text-[5rem] sm:text-[6rem] font-display font-bold text-foreground leading-none">
                  {data.due.total}
                </span>
              </div>

              <p className="text-sm text-muted-foreground mt-1">
                {data.due.kanji > 0 && <span>{data.due.kanji} 漢字</span>}
                {data.due.kanji > 0 && data.due.vocab > 0 && <span className="mx-2 opacity-40">·</span>}
                {data.due.vocab > 0 && <span>{data.due.vocab} 語彙</span>}
              </p>

              <div className="flex justify-center mt-7">
                <Link href="/review" className="start-review-cta">
                  <span className="font-serif text-sm opacity-70 mr-0.5">✦</span>
                  Start Review
                </Link>
              </div>
            </div>

          ) : (
            /* ── All caught up state ── */
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-medium">
                All Caught Up
              </p>
              <div className="border-t border-dashed border-border my-4 mx-auto max-w-[200px]" />
              <h2 className="text-4xl font-serif font-bold text-foreground">
                完璧です！
              </h2>
              <p className="text-sm text-muted-foreground mt-3">
                No reviews due · Next up in{' '}
                {data.forecast[1]?.count
                  ? `${data.forecast[1].count} items tomorrow`
                  : 'a few days'}
              </p>
              <div className="flex justify-center mt-6">
                <Link
                  href="/capture"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-[1.5px] border-dashed border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <Camera className="h-4 w-4" />
                  Capture More
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats Stamps ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-1">

        {/* Streak */}
        {data.stats && (
          <div className="stat-stamp" style={{ background: 'hsl(25 80% 97%)' }}>
            <div className="flex items-center justify-center gap-1 mb-2">
              <Flame className="h-3 w-3 text-orange-400" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
                Streak
              </span>
            </div>
            <p className="text-3xl font-display font-bold leading-none" style={{ color: 'hsl(20 65% 45%)' }}>
              {data.stats.currentStreak}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {data.stats.currentStreak === 1 ? 'day' : 'days'}
              {data.stats.longestStreak > data.stats.currentStreak && (
                <span className="ml-1 opacity-60">· best {data.stats.longestStreak}</span>
              )}
            </p>
          </div>
        )}

        {/* Level */}
        <div className="stat-stamp" style={{ background: 'hsl(45 60% 97%)' }}>
          <div className="flex items-center justify-center gap-1 mb-2">
            <Zap className="h-3 w-3 text-amber-500" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
              Level
            </span>
          </div>
          <p className="text-3xl font-display font-bold leading-none" style={{ color: 'hsl(38 60% 38%)' }}>
            {data.stats?.level ?? 1}
          </p>
          {data.stats && (
            <p className="text-[11px] mt-1.5 font-serif" style={{ color: 'hsl(var(--deep-red))' }}>
              {data.stats.levelTitle}
            </p>
          )}
        </div>

        {/* Kanji count */}
        <div className="stat-stamp" style={{ background: 'hsl(150 40% 97%)' }}>
          <div className="flex items-center justify-center gap-1 mb-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
              漢字
            </span>
          </div>
          <p className="text-3xl font-display font-bold leading-none" style={{ color: 'hsl(150 40% 32%)' }}>
            {data.counts.kanji}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1.5">learned</p>
        </div>

        {/* Vocab count */}
        <div className="stat-stamp" style={{ background: 'hsl(240 40% 97%)' }}>
          <div className="flex items-center justify-center gap-1 mb-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
              語彙
            </span>
          </div>
          <p className="text-3xl font-display font-bold leading-none" style={{ color: 'hsl(240 35% 45%)' }}>
            {data.counts.vocab}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1.5">words</p>
        </div>
      </div>

      {/* ── XP Progress + Daily Goal ──────────────────────── */}
      {data.stats && (
        <div className="grid gap-4 md:grid-cols-2 stagger-2">

          {/* XP Progress */}
          <div className="dash-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
                Experience
              </span>
            </div>
            <XPBar
              xpInLevel={data.stats.xpInLevel}
              xpForNext={data.stats.xpForNext}
              level={data.stats.level}
              totalXp={data.stats.xp}
            />
          </div>

          {/* Daily goal ring */}
          <div className="dash-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
                Daily Goal
              </span>
            </div>
            <div className="flex items-center gap-5">
              <DailyRing done={data.stats.dailyToday} goal={data.stats.dailyGoal} />
              <div className="flex-1 min-w-0">
                {data.stats.dailyToday >= data.stats.dailyGoal ? (
                  <>
                    <p className="font-display font-bold text-lg leading-tight" style={{ color: 'hsl(150 45% 38%)' }}>
                      Goal reached!
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Keep going for bonus XP
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-display font-bold text-lg text-foreground leading-tight">
                      {data.stats.dailyGoal - data.stats.dailyToday} more
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      to hit your daily goal
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Recently Learned Kanji Strip ──────────────────── */}
      {data.recentKanji.length > 0 && (
        <div className="stagger-3">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
              Recently Learned
            </h2>
            <Link
              href="/library"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all →
            </Link>
          </div>

          {/* Horizontally scrollable strip */}
          <div
            className="flex gap-2.5 overflow-x-auto pb-2"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              scrollSnapType: 'x mandatory',
            }}
          >
            {data.recentKanji.map((k) => {
              const dotClass = SRS_DOT[k.confidenceLevel] ?? 'srs-apprentice';
              const meaning = k.meanings[0] ?? '';
              return (
                <Link
                  key={k.character}
                  href="/library"
                  className="flex-shrink-0 flex flex-col items-center gap-2 dash-card p-3 w-[68px] hover:-translate-y-0.5 transition-all duration-200 group"
                  style={{ scrollSnapAlign: 'start' }}
                  title={meaning}
                >
                  <span className="text-[2rem] font-serif leading-none text-foreground group-hover:scale-105 transition-transform duration-200">
                    {k.character}
                  </span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${dotClass} flex-shrink-0`}
                    title={SRS_LABEL[k.confidenceLevel]}
                  />
                </Link>
              );
            })}
          </div>

          {/* SRS legend */}
          <div className="flex items-center gap-4 mt-2 pl-0.5">
            {Object.entries(SRS_LABEL).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${SRS_DOT[key]}`} />
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Review Forecast + Knowledge Strength ──────────── */}
      <div className="grid gap-4 md:grid-cols-2 stagger-4">

        {/* 7-day forecast */}
        <div className="dash-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
              Coming Up
            </span>
          </div>
          <div className="flex items-end gap-2 h-20">
            {data.forecast.map((day, i) => (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                {day.count > 0 && (
                  <span className="text-[10px] font-mono text-muted-foreground">{day.count}</span>
                )}
                <div
                  className="w-full rounded-sm transition-all"
                  style={{
                    height: `${Math.max(3, (day.count / maxForecast) * 64)}px`,
                    background: i === 0 ? 'hsl(15 55% 48%)' : 'hsl(25 20% 85%)',
                  }}
                />
                <span
                  className={`text-[10px] font-medium ${
                    i === 0 ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {day.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Knowledge strength */}
        <div className="dash-card p-5">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
            Knowledge Strength
          </span>
          <div className="space-y-3 mt-4">
            {(["kanji", "vocab"] as const).map((type) => {
              const conf = type === "kanji" ? data.confidence.kanji : data.confidence.vocab;
              const total = Object.values(conf).reduce((a, b) => a + b, 0);
              if (total === 0) return null;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-foreground">
                      {type === "kanji" ? "漢字" : "語彙"}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">{total}</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden flex" style={{ background: 'hsl(35 20% 92%)' }}>
                    {(["known", "reviewing", "learning", "new"] as const).map((level) => {
                      const count = conf[level] || 0;
                      if (count === 0) return null;
                      return (
                        <div
                          key={level}
                          className={`h-full ${CONFIDENCE_COLORS[level].bg} first:rounded-l-full last:rounded-r-full`}
                          style={{ width: `${(count / total) * 100}%` }}
                          title={`${CONFIDENCE_COLORS[level].label}: ${count}`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4">
            {Object.entries(CONFIDENCE_COLORS).map(([key, { bg, label }]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${bg}`} />
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────── */}
      <div className="grid gap-3 md:grid-cols-2 stagger-5">
        <Link
          href="/capture"
          className="group flex items-center gap-4 dash-card p-4 hover:-translate-y-0.5 transition-all duration-200"
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border border-dashed transition-colors group-hover:border-foreground/20"
            style={{ borderColor: 'hsl(35 15% 82%)' }}
          >
            <Camera className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm text-foreground">Capture New</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              Upload notes or photos to extract kanji
            </p>
          </div>
          <span className="ml-auto text-muted-foreground/40 group-hover:translate-x-0.5 transition-transform text-sm">→</span>
        </Link>

        <Link
          href="/library"
          className="group flex items-center gap-4 dash-card p-4 hover:-translate-y-0.5 transition-all duration-200"
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border border-dashed transition-colors group-hover:border-foreground/20"
            style={{ borderColor: 'hsl(35 15% 82%)' }}
          >
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm text-foreground">Your Library</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              Browse kanji, vocabulary, and sentences
            </p>
          </div>
          <span className="ml-auto text-muted-foreground/40 group-hover:translate-x-0.5 transition-transform text-sm">→</span>
        </Link>
      </div>

      {/* ── Lifetime Stats ────────────────────────────────── */}
      {data.stats && data.stats.totalReviews > 0 && (
        <div className="dash-card stagger-6">
          <div className="flex items-center justify-around text-center px-5 py-4">
            <div>
              <p className="text-xl font-display font-bold text-foreground">{data.stats.totalReviews}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-[0.15em]">Reviews</p>
            </div>
            <div className="h-8 border-l border-dashed border-border" />
            <div>
              <p className="text-xl font-display font-bold" style={{ color: 'hsl(150 40% 35%)' }}>{data.stats.accuracy}%</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-[0.15em]">Accuracy</p>
            </div>
            <div className="h-8 border-l border-dashed border-border" />
            <div>
              <p className="text-xl font-display font-bold text-foreground">{data.counts.sentences}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-[0.15em]">Sentences</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
