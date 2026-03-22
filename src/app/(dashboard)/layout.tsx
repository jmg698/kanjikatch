import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, reviewTracks } from "@/db";
import { eq, and, or, lte, isNull, sql } from "drizzle-orm";
import { TopNav } from "@/components/dashboard/top-nav";

async function getDueCount(userId: string): Promise<number> {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/f6d443fc-81bd-4a2a-96c6-1029ff40c4d4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'01298a'},body:JSON.stringify({sessionId:'01298a',location:'layout.tsx:getDueCount',message:'getDueCount called',data:{userId},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
  // #endregion
  try {
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
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/f6d443fc-81bd-4a2a-96c6-1029ff40c4d4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'01298a'},body:JSON.stringify({sessionId:'01298a',location:'layout.tsx:getDueCount:success',message:'getDueCount succeeded',data:{count:result?.count},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    return result.count;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/f6d443fc-81bd-4a2a-96c6-1029ff40c4d4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'01298a'},body:JSON.stringify({sessionId:'01298a',location:'layout.tsx:getDueCount:error',message:'getDueCount FAILED',data:{error:errMsg},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    throw err;
  }
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
      <header
        className="sticky top-0 z-50 w-full border-b bg-white/85 backdrop-blur-md"
        style={{ borderColor: 'hsl(35 15% 87%)' }}
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
