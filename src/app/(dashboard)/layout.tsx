import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, kanji, vocabulary } from "@/db";
import { eq, and, or, lte, isNull, sql } from "drizzle-orm";
import { BottomNav } from "@/components/dashboard/bottom-nav";

async function getDueCount(userId: string): Promise<number> {
  const now = new Date();
  const [kanjiDue] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(kanji)
    .where(and(eq(kanji.userId, userId), or(lte(kanji.nextReviewAt, now), isNull(kanji.nextReviewAt))));
  const [vocabDue] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vocabulary)
    .where(and(eq(vocabulary.userId, userId), or(lte(vocabulary.nextReviewAt, now), isNull(vocabulary.nextReviewAt))));
  return kanjiDue.count + vocabDue.count;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const dueCount = await getDueCount(userId);

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal premium header — logo + profile only */}
      <header
        className="sticky top-0 z-50 w-full border-b bg-white/85 backdrop-blur-md"
        style={{ borderColor: 'hsl(35 15% 87%)' }}
      >
        <div className="container flex h-13 items-center justify-between px-4 py-3">
          {/* Wordmark */}
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <span
              className="text-2xl font-serif leading-none transition-opacity group-hover:opacity-80"
              style={{ color: 'hsl(var(--deep-red))' }}
            >
              漢
            </span>
            <div className="flex flex-col leading-none">
              <span className="font-semibold text-sm tracking-wide text-foreground">
                KanjiKatch
              </span>
              <span className="text-[10px] tracking-[0.15em] text-muted-foreground font-sans">
                漢字キャッチ
              </span>
            </div>
          </Link>

          {/* User profile */}
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {/* Main content — padded bottom for fixed bottom nav */}
      <main className="container px-4 py-6 pb-24">
        {children}
      </main>

      {/* Permanent bottom navigation */}
      <BottomNav dueCount={dueCount} />
    </div>
  );
}
