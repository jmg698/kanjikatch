import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Camera, BookOpen, GraduationCap, Flame, Zap, Target, BarChart3 } from "lucide-react";
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
    <div className="space-y-5 animate-float-up">

      {/* ── Hero Card ─────────────────────────────────────── */}
      <div className="premium-hero rounded-2xl overflow-hidden">
        {/* Ghosted watermark character */}
        <span
          className="absolute text-[clamp(8rem,30vw,18rem)] font-serif leading-none select-none pointer-events-none"
          style={{
            color: 'rgba(255,255,255,0.028)',
            top: '-10%',
            right: '-2%',
            lineHeight: 1,
          }}
          aria-hidden
        >
          漢
        </span>

        <div className="relative z-10 px-6 py-7 sm:px-8 sm:py-9">
          {isNewUser ? (
            /* Welcome state */
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="text-center sm:text-left">
                <p className="text-white/45 text-xs uppercase tracking-[0.3em] mb-2 font-sans">
                  Welcome to KanjiKatch
                </p>
                <h2 className="text-3xl font-serif font-bold text-white leading-tight">
                  Start your journey
                </h2>
                <p className="text-white/45 text-sm mt-2 font-sans">
                  Capture kanji from your study materials to begin
                </p>
              </div>
              <Button
                asChild
                className="shimmer-btn h-12 px-7 rounded-xl font-semibold text-base shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, hsl(38 70% 52%), hsl(33 80% 45%))',
                  color: '#fff',
                  border: 'none',
                }}
              >
                <Link href="/capture">
                  <Camera className="h-5 w-5 mr-2" />
                  Capture Kanji
                </Link>
              </Button>
            </div>
          ) : data.due.total > 0 ? (
            /* Items due state */
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="text-center sm:text-left">
                <p className="text-white/45 text-xs uppercase tracking-[0.3em] mb-3 font-sans">
                  Ready for Review
                </p>
                <div className="flex items-baseline gap-3">
                  <span
                    className="text-[5.5rem] font-serif font-bold text-white leading-none glow-pulse"
                    style={{ lineHeight: 0.9 }}
                  >
                    {data.due.total}
                  </span>
                  <span className="text-white/35 text-xl font-sans mt-2">items</span>
                </div>
                <p className="text-white/40 text-sm mt-3 font-sans">
                  {data.due.kanji > 0 && <span>{data.due.kanji} 漢字</span>}
                  {data.due.kanji > 0 && data.due.vocab > 0 && <span className="mx-2 opacity-50">·</span>}
                  {data.due.vocab > 0 && <span>{data.due.vocab} 語彙</span>}
                </p>
              </div>
              <Button
                asChild
                className="shimmer-btn h-13 px-8 rounded-xl font-bold text-base shadow-xl"
                style={{
                  background: 'linear-gradient(135deg, hsl(38 70% 52%), hsl(33 80% 42%))',
                  color: '#fff',
                  border: 'none',
                  height: '3.25rem',
                  minWidth: '10rem',
                }}
              >
                <Link href="/review">
                  <GraduationCap className="h-5 w-5 mr-2" />
                  Start Review
                </Link>
              </Button>
            </div>
          ) : (
            /* All caught up state */
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="text-center sm:text-left">
                <p className="text-white/45 text-xs uppercase tracking-[0.3em] mb-2 font-sans">
                  All caught up
                </p>
                <h2 className="text-3xl font-serif font-bold text-white">
                  完璧です！
                </h2>
                <p className="text-white/40 text-sm mt-2 font-sans">
                  No reviews due · Next up in{' '}
                  {data.forecast[1]?.count
                    ? `${data.forecast[1].count} items tomorrow`
                    : 'a few days'}
                </p>
              </div>
              <Button
                asChild
                variant="outline"
                className="shimmer-btn h-12 px-7 rounded-xl font-semibold text-base"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  borderColor: 'rgba(255,255,255,0.2)',
                  color: 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <Link href="/capture">
                  <Camera className="h-5 w-5 mr-2" />
                  Capture More
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats Strip ───────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

        {/* Streak */}
        {data.stats && (
          <div className="premium-stat-card relative overflow-hidden">
            {/* Faint flame glyph behind */}
            <span
              className="absolute right-2 top-1 text-5xl select-none pointer-events-none"
              style={{ opacity: 0.07 }}
              aria-hidden
            >
              🔥
            </span>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1 mb-2">
              <Flame className="h-3 w-3 text-orange-400" />
              Streak
            </p>
            <p className="text-4xl font-serif font-bold leading-none" style={{ color: 'hsl(25 90% 52%)' }}>
              {data.stats.currentStreak}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">
              {data.stats.currentStreak === 1 ? 'day' : 'days'}
              {data.stats.longestStreak > data.stats.currentStreak && (
                <span className="ml-1 opacity-60">· best {data.stats.longestStreak}</span>
              )}
            </p>
          </div>
        )}

        {/* Level */}
        <div className="premium-stat-card relative overflow-hidden">
          <span
            className="absolute right-2 top-1 text-5xl select-none pointer-events-none"
            style={{ opacity: 0.07 }}
            aria-hidden
          >
            ⚡
          </span>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1 mb-2">
            <Zap className="h-3 w-3 text-amber-500" />
            Level
          </p>
          <p className="text-4xl font-serif font-bold leading-none text-primary">
            {data.stats?.level ?? 1}
          </p>
          {data.stats && (
            <p className="text-xs mt-1.5 font-serif" style={{ color: 'hsl(var(--deep-red))' }}>
              {data.stats.levelTitle}
            </p>
          )}
        </div>

        {/* Kanji count */}
        <div className="premium-stat-card relative overflow-hidden">
          <span
            className="absolute right-2 top-0 text-5xl font-serif select-none pointer-events-none"
            style={{ opacity: 0.06, color: 'hsl(var(--deep-red))' }}
            aria-hidden
          >
            漢
          </span>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1 mb-2">
            <BookOpen className="h-3 w-3" />
            Kanji
          </p>
          <p className="text-4xl font-serif font-bold leading-none text-foreground">
            {data.counts.kanji}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">learned</p>
        </div>

        {/* Vocab count */}
        <div className="premium-stat-card relative overflow-hidden">
          <span
            className="absolute right-2 top-0 text-5xl font-serif select-none pointer-events-none"
            style={{ opacity: 0.06, color: 'hsl(152 60% 30%)' }}
            aria-hidden
          >
            語
          </span>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1 mb-2">
            <BookOpen className="h-3 w-3" />
            Vocab
          </p>
          <p className="text-4xl font-serif font-bold leading-none text-foreground">
            {data.counts.vocab}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">words</p>
        </div>
      </div>

      {/* ── XP Progress + Daily Goal ──────────────────────── */}
      {data.stats && (
        <div className="grid gap-4 md:grid-cols-2">

          {/* XP Progress bar */}
          <div className="bg-white border rounded-xl p-5" style={{ borderColor: 'hsl(35 15% 87%)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-medium">
                XP Progress
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
          <div className="bg-white border rounded-xl p-5" style={{ borderColor: 'hsl(35 15% 87%)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-medium">
                Daily Goal
              </span>
            </div>
            <div className="flex items-center gap-5">
              <DailyRing done={data.stats.dailyToday} goal={data.stats.dailyGoal} />
              <div className="flex-1 min-w-0">
                {data.stats.dailyToday >= data.stats.dailyGoal ? (
                  <>
                    <p className="font-serif font-bold text-lg text-primary leading-tight">
                      Goal reached!
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Keep going for bonus XP ✦
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-serif font-bold text-lg text-foreground leading-tight">
                      {data.stats.dailyGoal - data.stats.dailyToday} more
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      to hit your daily goal
                    </p>
                    <p className="text-xs text-amber-600 mt-2 font-medium">
                      ✦ Finish for bonus XP
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
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">
              Recently Learned
            </h2>
            <Link
              href="/library"
              className="text-xs text-primary hover:underline underline-offset-2 transition-opacity hover:opacity-80"
            >
              View all →
            </Link>
          </div>

          {/* Horizontally scrollable strip */}
          <div
            className="flex gap-3 overflow-x-auto pb-2"
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
                  className="flex-shrink-0 flex flex-col items-center gap-2 bg-white border rounded-xl p-3.5 w-[72px] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
                  style={{ borderColor: 'hsl(35 15% 88%)', scrollSnapAlign: 'start' }}
                  title={meaning}
                >
                  <span className="text-[2.2rem] font-serif leading-none text-foreground group-hover:scale-105 transition-transform duration-200">
                    {k.character}
                  </span>
                  {/* SRS stage dot */}
                  <span
                    className={`w-2 h-2 rounded-full ${dotClass} flex-shrink-0`}
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
                <span className={`w-2 h-2 rounded-full ${SRS_DOT[key]}`} />
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Review Forecast + Knowledge Strength ──────────── */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* 7-day forecast */}
        <div className="bg-white border rounded-xl p-5" style={{ borderColor: 'hsl(35 15% 87%)' }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-medium">
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
                  className={`w-full rounded-t-sm transition-all ${
                    i === 0 ? 'bg-primary' : 'bg-primary/25'
                  }`}
                  style={{ height: `${Math.max(3, (day.count / maxForecast) * 64)}px` }}
                />
                <span
                  className={`text-[10px] font-medium ${
                    i === 0 ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {day.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Knowledge strength */}
        <div className="bg-white border rounded-xl p-5" style={{ borderColor: 'hsl(35 15% 87%)' }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-medium">
              Knowledge Strength
            </span>
          </div>
          <div className="space-y-3">
            {(["kanji", "vocab"] as const).map((type) => {
              const conf = type === "kanji" ? data.confidence.kanji : data.confidence.vocab;
              const total = Object.values(conf).reduce((a, b) => a + b, 0);
              if (total === 0) return null;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium capitalize text-foreground">{type}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">{total}</span>
                  </div>
                  <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden flex">
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
                <div className={`w-2 h-2 rounded-full ${bg}`} />
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────── */}
      <div className="grid gap-3 md:grid-cols-2">
        <Link
          href="/capture"
          className="group flex items-center gap-4 bg-white border rounded-xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          style={{ borderColor: 'hsl(35 15% 87%)' }}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
            style={{ background: 'hsl(35 28% 94%)' }}
          >
            <Camera className="h-5 w-5 text-foreground/60" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground">Capture New</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              Upload notes or photos to extract kanji
            </p>
          </div>
          <span className="ml-auto text-muted-foreground/50 group-hover:translate-x-0.5 transition-transform">→</span>
        </Link>

        <Link
          href="/library"
          className="group flex items-center gap-4 bg-white border rounded-xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          style={{ borderColor: 'hsl(35 15% 87%)' }}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
            style={{ background: 'hsl(35 28% 94%)' }}
          >
            <BookOpen className="h-5 w-5 text-foreground/60" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground">Your Library</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              Browse kanji, vocabulary, and sentences
            </p>
          </div>
          <span className="ml-auto text-muted-foreground/50 group-hover:translate-x-0.5 transition-transform">→</span>
        </Link>
      </div>

      {/* ── Lifetime Stats ────────────────────────────────── */}
      {data.stats && data.stats.totalReviews > 0 && (
        <div
          className="bg-white border rounded-xl px-5 py-4 flex items-center justify-around text-center"
          style={{ borderColor: 'hsl(35 15% 87%)' }}
        >
          <div>
            <p className="text-2xl font-serif font-bold text-foreground">{data.stats.totalReviews}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-wide">Reviews</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <p className="text-2xl font-serif font-bold text-primary">{data.stats.accuracy}%</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-wide">Accuracy</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <p className="text-2xl font-serif font-bold text-foreground">{data.counts.sentences}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-wide">Sentences</p>
          </div>
        </div>
      )}
    </div>
  );
}
