import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Camera, BookOpen, GraduationCap, LayoutDashboard, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db, kanji, vocabulary } from "@/db";
import { eq, and, or, lte, isNull, sql } from "drizzle-orm";

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
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-card">
        <div className="container flex h-14 items-center px-4">
          <Link href="/dashboard" className="flex items-center gap-2 mr-6">
            <span className="text-xl font-bold text-primary">漢字</span>
            <span className="font-semibold hidden sm:inline">KanjiKatch</span>
          </Link>
          
          <nav className="flex items-center gap-1 flex-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/capture">
                <Camera className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Capture</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/library">
                <BookOpen className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Library</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/review" className="relative">
                <GraduationCap className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Review</span>
                {dueCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
                    {dueCount > 99 ? "99+" : dueCount}
                  </span>
                )}
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/read" className="relative">
                <FileText className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Read</span>
                <span className="absolute -top-1 -right-1 text-[8px] bg-muted text-muted-foreground px-1 rounded font-medium">
                  Soon
                </span>
              </Link>
            </Button>
          </nav>

          <div className="flex items-center gap-4">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container px-4 py-6">
        {children}
      </main>
    </div>
  );
}
