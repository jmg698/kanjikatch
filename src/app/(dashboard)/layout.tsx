import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Camera, BookOpen, GraduationCap, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

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
              <Link href="/review">
                <GraduationCap className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Review</span>
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
