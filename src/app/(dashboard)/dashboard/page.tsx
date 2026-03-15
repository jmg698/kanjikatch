import Link from "next/link";
import { Camera, Flame } from "lucide-react";
import { db, kanji, vocabulary, userStats } from "@/db";
import { getCurrentUserId } from "@/lib/auth";
import { eq, and, or, lte, isNull, desc, sql } from "drizzle-orm";

async function getDashboardData(userId: string) {
  const now = new Date();

  const [
    [kanjiCount],
    [vocabCount],
    [kanjiDue],
    [vocabDue],
    stats,
    recentKanji,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(kanji).where(eq(kanji.userId, userId)),
    db.select({ count: sql<number>`count(*)::int` }).from(vocabulary).where(eq(vocabulary.userId, userId)),
    db.select({ count: sql<number>`count(*)::int` }).from(kanji).where(
      and(eq(kanji.userId, userId), or(lte(kanji.nextReviewAt, now), isNull(kanji.nextReviewAt)))
    ),
    db.select({ count: sql<number>`count(*)::int` }).from(vocabulary).where(
      and(eq(vocabulary.userId, userId), or(lte(vocabulary.nextReviewAt, now), isNull(vocabulary.nextReviewAt)))
    ),
    db.select().from(userStats).where(eq(userStats.userId, userId)).then((r) => r[0] ?? null),
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

  return {
    counts: { kanji: kanjiCount.count, vocab: vocabCount.count },
    due: { kanji: kanjiDue.count, vocab: vocabDue.count, total: kanjiDue.count + vocabDue.count },
    streak: stats?.currentStreak ?? 0,
    recentKanji,
  };
}

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

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  const data = await getDashboardData(userId);
  const isNewUser = data.counts.kanji === 0 && data.counts.vocab === 0;

  return (
    <div className="max-w-xl mx-auto space-y-10 py-2 md:py-6">

      {/* ── "Do I have reviews?" ── */}
      <section className="stagger-0">
        {isNewUser ? (
          <div className="bg-white border border-border rounded-2xl px-6 py-10 text-center">
            <h2 className="text-4xl sm:text-5xl font-serif font-bold text-foreground leading-tight">
              はじめましょう
            </h2>
            <p className="text-sm text-muted-foreground mt-4 max-w-sm mx-auto leading-relaxed">
              Photograph your handwritten notes and AI will extract kanji
              and vocabulary for spaced repetition review.
            </p>
            <div className="mt-8">
              <Link
                href="/capture"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-white font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: 'hsl(15 55% 48%)' }}
              >
                <Camera className="h-4 w-4" />
                Capture Your Notes
              </Link>
            </div>
          </div>

        ) : data.due.total > 0 ? (
          <div className="bg-white border border-border rounded-2xl px-6 py-8 text-center">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-medium">
              Ready for Review
            </p>
            <div className="mt-4 mb-3">
              <span className="text-7xl sm:text-8xl font-display font-bold text-foreground leading-none">
                {data.due.total}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {data.due.kanji > 0 && <span>{data.due.kanji} kanji</span>}
              {data.due.kanji > 0 && data.due.vocab > 0 && <span className="mx-1.5 opacity-40">·</span>}
              {data.due.vocab > 0 && <span>{data.due.vocab} vocab</span>}
            </p>
            <div className="mt-7">
              <Link
                href="/review"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-white font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: 'hsl(15 55% 48%)' }}
              >
                Start Review
              </Link>
            </div>
          </div>

        ) : (
          <div className="bg-white border border-border rounded-2xl px-6 py-10 text-center">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-medium">
              All Caught Up
            </p>
            <h2 className="text-4xl font-serif font-bold text-foreground mt-4">
              完璧です！
            </h2>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              No reviews due right now. Capture more notes to keep learning.
            </p>
            <div className="mt-7">
              <Link
                href="/capture"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: 'hsl(15 55% 48%)' }}
              >
                <Camera className="h-4 w-4" />
                Capture Notes
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ── "How am I doing?" ── */}
      {!isNewUser && (
        <section className="stagger-1">
          <div className={`grid ${data.streak > 1 ? 'grid-cols-3' : 'grid-cols-2'} text-center`}>
            {data.streak > 1 && (
              <div>
                <p className="text-3xl font-display font-bold text-foreground leading-none">
                  {data.streak}
                </p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-2.5 font-medium flex items-center justify-center gap-1">
                  <Flame className="h-3 w-3 text-orange-400" />
                  Day Streak
                </p>
              </div>
            )}
            <div>
              <p className="text-3xl font-display font-bold text-foreground leading-none">
                {data.counts.kanji}
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-2.5 font-medium">
                Kanji Learned
              </p>
            </div>
            <div>
              <p className="text-3xl font-display font-bold text-foreground leading-none">
                {data.counts.vocab}
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-2.5 font-medium">
                Vocabulary
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── "What have I been learning?" ── */}
      {data.recentKanji.length > 0 && (
        <section className="stagger-2">
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

          <div
            className="flex gap-2.5 overflow-x-auto pb-2"
            style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
          >
            {data.recentKanji.map((k) => {
              const dotClass = SRS_DOT[k.confidenceLevel] ?? 'srs-apprentice';
              return (
                <Link
                  key={k.character}
                  href="/library"
                  className="flex-shrink-0 flex flex-col items-center gap-2 bg-white border border-border rounded-xl p-3 w-[68px] hover:-translate-y-0.5 transition-all duration-200"
                  style={{ scrollSnapAlign: 'start' }}
                  title={k.meanings[0] ?? ''}
                >
                  <span className="text-[2rem] font-serif leading-none text-foreground">
                    {k.character}
                  </span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${dotClass}`}
                    title={SRS_LABEL[k.confidenceLevel]}
                  />
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-4 mt-2">
            {Object.entries(SRS_LABEL).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${SRS_DOT[key]}`} />
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
