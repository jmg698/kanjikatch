import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, reviewTracks } from "@/db";
import { eq, and, or, lte, isNull, sql } from "drizzle-orm";
import { TopNav } from "@/components/dashboard/top-nav";

async function getDueCount(userId: string): Promise<number> {
  const now = new Date();
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reviewTracks)
    .where(
      and(
        eq(reviewTracks.userId, userId),
        or(lte(reviewTracks.nextReviewAt, now), isNull(reviewTracks.nextReviewAt)),
      ),
    );
  return result.count;
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
    <div className="min-h-screen dash-bg">
      <header
        className="sticky top-0 z-50 w-full border-b bg-white/85 backdrop-blur-md"
        style={{ borderColor: 'hsl(220 10% 82%)' }}
      >
        <div className="container px-4">
          {/* Primary row: logo + desktop nav + user */}
          <div className="flex items-center justify-between py-2.5">
            <Link href="/dashboard" className="flex flex-col leading-none group flex-shrink-0">
              <span className="font-semibold text-sm tracking-wide text-foreground transition-opacity group-hover:opacity-80">
                KanjiKatch
              </span>
              <span className="text-[10px] tracking-[0.15em] text-muted-foreground font-sans">
                漢字キャッチ
              </span>
            </Link>

            {/* Desktop navigation inline */}
            <div className="hidden md:block flex-1 mx-6">
              <TopNav dueCount={dueCount} />
            </div>

            <UserButton afterSignOutUrl="/" />
          </div>

          {/* Mobile navigation row */}
          <div className="md:hidden pb-2 -mt-0.5">
            <TopNav dueCount={dueCount} />
          </div>
        </div>
      </header>

      <main className="container px-4 py-6">
        {children}
      </main>
    </div>
  );
}
