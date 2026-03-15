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
    <div className="max-w-xl mx-auto space-y-8 py-2 md:py-6">

      {/* ── Top Row: status + counts ── */}
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
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                <Camera className="h-4 w-4" />
                Capture Your Notes
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {/* Left: Review status */}
            <div className="bg-white border border-border rounded-2xl p-5 flex flex-col">
              {data.due.total > 0 ? (
                <>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-medium">
                    Ready for Review
                  </p>
                  <span className="text-4xl sm:text-5xl font-display font-bold text-foreground leading-none mt-3">
                    {data.due.total}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {data.due.kanji > 0 && <span>{data.due.kanji} kanji</span>}
                    {data.due.kanji > 0 && data.due.vocab > 0 && <span className="mx-1 opacity-40">·</span>}
                    {data.due.vocab > 0 && <span>{data.due.vocab} vocab</span>}
                  </p>
                  {data.streak > 1 && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Flame className="h-3 w-3 text-orange-400" />
                      {data.streak} day streak
                    </p>
                  )}
                  <div className="mt-auto pt-4">
                    <Link
                      href="/review"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold transition-all hover:bg-primary/90 active:scale-[0.98]"
                    >
                      Start Review
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-medium">
                    All Caught Up
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-serif font-bold text-foreground mt-3 leading-tight">
                    完璧です！
                  </h2>
                  <p className="text-xs text-muted-foreground mt-2">
                    No reviews due right now
                  </p>
                  {data.streak > 1 && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Flame className="h-3 w-3 text-orange-400" />
                      {data.streak} day streak
                    </p>
                  )}
                  <div className="mt-auto pt-4">
                    <Link
                      href="/capture"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold transition-all hover:bg-primary/90 active:scale-[0.98]"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      Capture Notes
                    </Link>
                  </div>
                </>
              )}
            </div>

            {/* Right: Capture button + combined counts */}
            <div className="flex flex-col gap-3">
              <Link
                href="/capture"
                className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-primary text-primary-foreground py-5 font-semibold transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                <Camera className="h-5 w-5" />
                <span className="text-base">Capture</span>
                <span className="text-xs font-normal opacity-90">add to your knowledge</span>
              </Link>
              <div className="bg-white border border-border rounded-2xl p-5 flex-1 flex flex-col justify-center">
                <div className="flex items-baseline gap-3">
                  <p className="text-3xl sm:text-4xl font-display font-bold text-foreground leading-none">
                    {data.counts.kanji}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
                    Kanji
                  </p>
                </div>
                <div className="border-t border-border my-3" />
                <div className="flex items-baseline gap-3">
                  <p className="text-3xl sm:text-4xl font-display font-bold text-foreground leading-none">
                    {data.counts.vocab}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
                    Vocab
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

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
