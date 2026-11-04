import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HelpNotFound() {
  return (
    <main className="container mx-auto px-4 sm:px-6 py-24 max-w-xl text-center">
      <p className="font-serif text-4xl text-primary">迷子</p>
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">We couldn&apos;t find that article</h1>
      <p className="mt-3 text-muted-foreground">It may have moved. Try searching the Help Center instead.</p>
      <Button className="mt-8" asChild>
        <Link href="/help">Go to the Help Center</Link>
      </Button>
    </main>
  );
}
