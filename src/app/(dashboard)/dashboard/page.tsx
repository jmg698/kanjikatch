import Link from "next/link";
import { Camera, Flame } from "lucide-react";
import { db, kanji, vocabulary, userStats, reviewTracks } from "@/db";
import { getCurrentUserId } from "@/lib/auth";
import { eq, and, or, lte, isNull, desc, asc, sql, inArray } from "drizzle-orm";
import { computeEffectiveConfidence } from "@/lib/track-queries";
import { StaticCityscapeBackground } from "@/components/dashboard/static-cityscape-background";

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
    db.select({ count: sql<number>`count(*)::int` }).from(reviewTracks).where(
      and(
        eq(reviewTracks.userId, userId),
        eq(reviewTracks.itemType, "kanji"),
        or(lte(reviewTracks.nextReviewAt, now), isNull(reviewTracks.nextReviewAt)),
      )
    ),
    db.select({ count: sql<number>`count(*)::int` }).from(reviewTracks).where(
      and(
        eq(reviewTracks.userId, userId),
        eq(reviewTracks.itemType, "vocab"),
        or(lte(reviewTracks.nextReviewAt, now), isNull(reviewTracks.nextReviewAt)),
      )
    ),
    db.select().from(userStats).where(eq(userStats.userId, userId)).then((r) => r[0] ?? null),
    db.select({
      character: kanji.character,
      id: kanji.id,
      meanings: kanji.meanings,
    })
      .from(kanji)
      .where(eq(kanji.userId, userId))
      .orderBy(desc(kanji.firstSeenAt))
      .limit(20),
  ]);

  // Compute effective confidence for recent kanji from their tracks
  const recentKanjiIds = recentKanji.map((k) => k.id);
  const recentTracks = recentKanjiIds.length > 0
    ? await db.select().from(reviewTracks).where(
        and(
          inArray(reviewTracks.itemId, recentKanjiIds),
          eq(reviewTracks.itemType, "kanji"),
        ),
      )
    : [];

  const tracksByItem = new Map<string, typeof recentTracks>();
  for (const t of recentTracks) {
    const existing = tracksByItem.get(t.itemId) || [];
    existing.push(t);
    tracksByItem.set(t.itemId, existing);
  }

  const recentKanjiWithConfidence = recentKanji.map((k) => ({
    character: k.character,
    confidenceLevel: computeEffectiveConfidence(tracksByItem.get(k.id) || []),
    meanings: k.meanings,
  }));

  // "Needs attention": items where any track has ease_factor < 2.00 and review_count >= 2
  const attentionTrackRows = await db
    .select({
      itemId: reviewTracks.itemId,
      easeFactor: sql<number>`MIN(${reviewTracks.easeFactor}::numeric)`,
      reviewCount: sql<number>`SUM(${reviewTracks.reviewCount})::int`,
      timesCorrect: sql<number>`SUM(${reviewTracks.timesCorrect})::int`,
    })
    .from(reviewTracks)
    .where(
      and(
        eq(reviewTracks.userId, userId),
        eq(reviewTracks.itemType, "kanji"),
      ),
    )
    .groupBy(reviewTracks.itemId)
    .having(
      and(
        sql`MIN(${reviewTracks.easeFactor}::numeric) < 2.00`,
        sql`MAX(${reviewTracks.reviewCount}) >= 2`,
      ),
    )
    .orderBy(sql`MIN(${reviewTracks.easeFactor}::numeric) ASC`)
    .limit(6);

  let needsAttention: { character: string; meanings: string[]; reviewCount: number; timesCorrect: number }[] = [];
  if (attentionTrackRows.length > 0) {
    const attentionItemIds = attentionTrackRows.map((r) => r.itemId);
    const attentionKanji = await db
      .select({ id: kanji.id, character: kanji.character, meanings: kanji.meanings })
      .from(kanji)
      .where(inArray(kanji.id, attentionItemIds));

    const kanjiMap = new Map(attentionKanji.map((k) => [k.id, k]));
    needsAttention = attentionTrackRows
      .map((row) => {
        const k = kanjiMap.get(row.itemId);
        if (!k) return null;
        return {
          character: k.character,
          meanings: k.meanings,
          reviewCount: row.reviewCount,
          timesCorrect: row.timesCorrect,
        };
      })
      .filter(Boolean) as typeof needsAttention;
  }

  return {
    counts: { kanji: kanjiCount.count, vocab: vocabCount.count },
    due: { kanji: kanjiDue.count, vocab: vocabDue.count, total: kanjiDue.count + vocabDue.count },
    streak: stats?.currentStreak ?? 0,
    recentKanji: recentKanjiWithConfidence,
    needsAttention,
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
    <>
      <StaticCityscapeBackground />
      <div className="relative z-10 max-w-xl mx-auto space-y-8 py-2 md:py-6">

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
                    <span className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-600 rounded-full px-2.5 py-1 text-xs font-medium mt-2">
                      <Flame className="h-3.5 w-3.5" />
                      {data.streak} day streak
                    </span>
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
                    <span className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-600 rounded-full px-2.5 py-1 text-xs font-medium mt-2">
                      <Flame className="h-3.5 w-3.5" />
                      {data.streak} day streak
                    </span>
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

      {/* ── "Needs Attention" ── */}
      {data.needsAttention.length > 0 && (
        <section className="stagger-1">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#C4707E] font-semibold mb-3">
            Needs Attention
          </h2>
          <div
            className="flex gap-2.5 overflow-x-auto pb-2"
            style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
          >
            {data.needsAttention.map((k) => {
              const accuracy = k.reviewCount > 0
                ? Math.round((k.timesCorrect / k.reviewCount) * 100)
                : 0;
              return (
                <Link
                  key={k.character}
                  href="/library"
                  className="flex-shrink-0 flex flex-col items-center gap-1.5 bg-white border border-[#F9A1B1]/40 rounded-xl p-3 w-[78px] hover:-translate-y-0.5 hover:shadow-md hover:border-[#F9A1B1]/70 transition-all duration-200"
                  style={{ scrollSnapAlign: 'start' }}
                  title={k.meanings[0] ?? ''}
                >
                  <span className="text-[2rem] font-serif leading-none text-foreground">
                    {k.character}
                  </span>
                  <span className="text-[10px] font-mono text-orange-500/80">
                    {accuracy}%
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── "What have I been learning?" ── */}
      {data.recentKanji.length > 0 && (
        <section className="stagger-2">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-primary font-semibold">
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
                  className="flex-shrink-0 flex flex-col items-center gap-2 bg-white border border-border rounded-xl p-3 w-[68px] hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
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
    </>
  );
}
