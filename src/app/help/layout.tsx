import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { HELP_SUPPORT_EMAIL } from "@/lib/help-center";

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/help" className="flex items-baseline gap-2.5 min-w-0">
            <span className="font-serif text-2xl text-primary leading-none">漢字</span>
            <span className="font-display text-xl font-semibold tracking-tight">KanjiKatch</span>
            <span className="hidden sm:inline text-sm text-muted-foreground border-l border-border pl-2.5">
              Help Center
            </span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4 text-sm">
            <a
              href={`mailto:${HELP_SUPPORT_EMAIL}`}
              className="hidden sm:inline text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact support
            </a>
            <SignedIn>
              <Button size="sm" asChild>
                <Link href="/dashboard">Open app</Link>
              </Button>
            </SignedIn>
            <SignedOut>
              <Link href="/sign-in" className="text-muted-foreground hover:text-foreground transition-colors">
                Sign in
              </Link>
              <Button size="sm" asChild>
                <Link href="/sign-up">Start free</Link>
              </Button>
            </SignedOut>
          </nav>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-border/60 mt-16">
        <div className="container mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} KanjiKatch</p>
          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/help" className="hover:text-foreground transition-colors">Help Center</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <a href={`mailto:${HELP_SUPPORT_EMAIL}`} className="hover:text-foreground transition-colors">
              {HELP_SUPPORT_EMAIL}
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
