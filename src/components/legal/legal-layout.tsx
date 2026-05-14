import Link from "next/link";
import { Button } from "@/components/ui/button";

// Shared layout for /terms and /privacy. Mirrors the landing-page header
// chrome so the legal pages don't feel like a separate site.
export function LegalLayout({
  title,
  lastUpdated,
  isSignedIn,
  children,
}: {
  title: string;
  lastUpdated: string;
  isSignedIn: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border/60">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-baseline gap-2.5">
            <span className="font-serif text-2xl text-primary leading-none">漢字</span>
            <span className="font-display text-xl font-semibold tracking-tight">KanjiKatch</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-3">
            <Link
              href="/pricing"
              className="hidden md:inline text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
            >
              Pricing
            </Link>
            {isSignedIn ? (
              <Button asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/sign-up">Get started</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-6 max-w-3xl">
          <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70">
            Last updated · {lastUpdated}
          </p>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl font-bold tracking-tight">
            {title}
          </h1>
        </section>

        <section className="container mx-auto px-4 sm:px-6 pb-20 max-w-3xl">
          <div className="legal-prose">{children}</div>
        </section>
      </main>
    </div>
  );
}
