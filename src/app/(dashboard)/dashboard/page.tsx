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

      <div className="relative z-10 max-w-xl mx-auto mt-6 pb-12">
        <div className="dash-facade px-5 pt-7 pb-7 sm:px-7 sm:pt-8 sm:pb-8">
          {isNewUser ? (
            <section className="stagger-0">
              <div className="window-pane px-6 py-10 text-center">
                <h2 className="text-4xl sm:text-5xl font-serif font-bold text-foreground leading-tight">
                  はじめましょう
                </h2>
                <p className="text-sm text-muted-foreground mt-4 max-w-sm mx-auto leading-relaxed">
                  Photograph your handwritten notes and AI will extract kanji
                  and vocabulary for spaced repetition review.
                </p>
                <div className="mt-7">
                  <Link
                    href="/capture"
                    className="lit-window inline-flex items-center gap-2 px-7 py-3.5 font-semibold"
                  >
                    <Camera className="h-4 w-4 relative z-10" />
                    <span className="relative z-10">Capture Your Notes</span>
                  </Link>
                </div>
              </div>
            </section>
          ) : (
            <>
              {/* ── Floor 1: Review hero + the lit Capture window ── */}
              <section className="stagger-0">
                <div className="grid grid-cols-2 gap-3">
                  {/* Left pane: Review status — the largest white window */}
                  <div className="window-pane p-5 flex flex-col">
                    {data.due.total > 0 ? (
                      <>
                        <p className="floor-label">Ready for Review</p>
                        <span className="text-4xl sm:text-5xl font-display font-bold text-foreground leading-none mt-3">
                          {data.due.total}
                        </span>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {data.due.kanji > 0 && <span>{data.due.kanji} kanji</span>}
                          {data.due.kanji > 0 && data.due.vocab > 0 && <span className="mx-1 opacity-40">·</span>}
                          {data.due.vocab > 0 && <span>{data.due.vocab} vocab</span>}
                        </p>
                        {data.streak > 1 && (
                          <span className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-600 rounded-full px-2.5 py-1 text-xs font-medium mt-2 self-start">
                            <Flame className="h-3.5 w-3.5" />
                            {data.streak} day streak
                          </span>
                        )}
                        <div className="mt-auto pt-4">
                          <Link
                            href="/review"
                            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold transition-all hover:bg-primary/90 active:scale-[0.98]"
                          >
                            Start Review
                          </Link>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="floor-label">All Caught Up</p>
                        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-foreground mt-3 leading-tight">
                          完璧です！
                        </h2>
                        <p className="text-xs text-muted-foreground mt-2">
                          No reviews due right now
                        </p>
                        {data.streak > 1 && (
                          <span className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-600 rounded-full px-2.5 py-1 text-xs font-medium mt-2 self-start">
                            <Flame className="h-3.5 w-3.5" />
                            {data.streak} day streak
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Right column: lit Capture window + counts pane */}
                  <div className="flex flex-col gap-3">
                    <Link
                      href="/capture"
                      aria-label="Capture new notes"
                      className="lit-window flex flex-col items-center justify-center gap-1 py-5 font-semibold"
                    >
                      <Camera className="h-5 w-5 relative z-10" />
                      <span className="text-base relative z-10">Capture</span>
                      <span className="text-[11px] font-normal opacity-90 relative z-10">
                        add to your knowledge
                      </span>
                    </Link>
                    <div className="window-pane p-5 flex-1 flex flex-col justify-center">
                      <div className="flex items-baseline gap-3">
                        <p className="text-3xl sm:text-4xl font-display font-bold text-foreground leading-none">
                          {data.counts.kanji}
                        </p>
                        <p className="floor-label">Kanji</p>
                      </div>
                      <div className="border-t border-border my-3" />
                      <div className="flex items-baseline gap-3">
                        <p className="text-3xl sm:text-4xl font-display font-bold text-foreground leading-none">
                          {data.counts.vocab}
                        </p>
                        <p className="floor-label">Vocab</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* ── Floor 2: Needs Attention ── */}
              {data.needsAttention.length > 0 && (
                <>
                  <div className="floor-divider mt-6 -mx-5 sm:-mx-7" />
                  <section className="stagger-1 pt-6">
                    <h2 className="floor-label floor-label-warning mb-3">
                      Needs Attention
                    </h2>
                    <div
                      className="flex gap-2.5 overflow-x-auto pb-1"
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
                            className="window-pane flex-shrink-0 flex flex-col items-center gap-1.5 p-3 w-[78px] hover:-translate-y-0.5 transition-transform duration-200"
                            style={{
                              scrollSnapAlign: 'start',
                              borderColor: 'rgba(196, 112, 126, 0.4)',
                            }}
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
                </>
              )}

              {/* ── Floor 3: Recently Learned ── */}
              {data.recentKanji.length > 0 && (
                <>
                  <div className="floor-divider mt-6 -mx-5 sm:-mx-7" />
                  <section className="stagger-2 pt-6">
                    <div className="flex items-baseline justify-between mb-3">
                      <h2 className="floor-label floor-label-primary">
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
                      className="flex gap-2.5 overflow-x-auto pb-1"
                      style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
                    >
                      {data.recentKanji.map((k) => {
                        const dotClass = SRS_DOT[k.confidenceLevel] ?? 'srs-apprentice';
                        return (
                          <Link
                            key={k.character}
                            href="/library"
                            className="window-pane flex-shrink-0 flex flex-col items-center gap-2 p-3 w-[68px] hover:-translate-y-0.5 transition-transform duration-200"
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

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
                      {Object.entries(SRS_LABEL).map(([key, label]) => (
                        <div key={key} className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${SRS_DOT[key]}`} />
                          <span className="text-[10px] text-muted-foreground">{label}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
