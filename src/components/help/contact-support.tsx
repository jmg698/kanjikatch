import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ContactSupport({ email, articleTitle }: { email: string; articleTitle?: string }) {
  const subject = articleTitle ? `Help with: ${articleTitle}` : "KanjiKatch support";
  return (
    <section className="rounded-xl border bg-background px-5 py-6 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Mail className="h-5 w-5" aria-hidden />
      </div>
      <div className="flex-1">
        <h2 className="font-display text-lg font-semibold">Still need help?</h2>
        <p className="text-sm text-muted-foreground">
          Can’t find what you’re looking for? Email us and a real person will get back to you.
        </p>
      </div>
      <Button asChild>
        <a href={`mailto:${email}?subject=${encodeURIComponent(subject)}`}>Email support</a>
      </Button>
    </section>
  );
}
