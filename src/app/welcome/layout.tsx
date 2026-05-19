import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function WelcomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div
      className="min-h-screen text-foreground"
      style={{
        background:
          "radial-gradient(60% 50% at 20% 10%, hsl(35 40% 94%) 0%, transparent 60%), radial-gradient(50% 40% at 90% 20%, hsl(150 30% 94%) 0%, transparent 60%), hsl(35 28% 97%)",
      }}
    >
      {/* Quiet brand anchor — matches the landing-page wordmark but smaller
          and non-interactive past the home link. Keeps the user grounded
          inside a KanjiKatch experience without competing with the welcome
          flow for attention. */}
      <div className="container mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        <Link
          href="/"
          className="inline-flex items-baseline gap-2 group"
          aria-label="KanjiKatch"
        >
          <span className="font-serif text-xl text-primary leading-none group-hover:opacity-80 transition-opacity">
            漢字
          </span>
          <span className="font-display text-base font-semibold tracking-tight group-hover:opacity-80 transition-opacity">
            KanjiKatch
          </span>
          <span className="hidden sm:inline text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70 ml-1">
            キャッチ
          </span>
        </Link>
      </div>

      <main className="container mx-auto px-4 sm:px-6 pt-4 pb-10 sm:pt-6 sm:pb-14">
        {children}
      </main>
    </div>
  );
}
