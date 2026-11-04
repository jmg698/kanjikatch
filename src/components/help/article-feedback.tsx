"use client";

import { useEffect, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";

type Stage = "ask" | "comment" | "sending" | "done" | "error";

const storageKey = (slug: string) => `kanjikatch:help-feedback:${slug}`;

export function ArticleFeedback({ slug, supportEmail }: { slug: string; supportEmail: string }) {
  const [stage, setStage] = useState<Stage>("ask");
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");

  // Remember a vote per browser so returning readers aren't asked again.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey(slug));
      if (saved === "yes" || saved === "no") {
        setHelpful(saved === "yes");
        setStage("done");
      }
    } catch {
      // Storage blocked — just ask again.
    }
  }, [slug]);

  async function send(vote: boolean, note: string | null) {
    setStage("sending");
    try {
      const res = await fetch("/api/help/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleSlug: slug, helpful: vote, comment: note }),
      });
      if (!res.ok) throw new Error(String(res.status));
      try {
        window.localStorage.setItem(storageKey(slug), vote ? "yes" : "no");
      } catch {
        // Not critical.
      }
      setStage("done");
    } catch {
      setStage("error");
    }
  }

  function vote(value: boolean) {
    setHelpful(value);
    if (value) void send(true, null);
    else setStage("comment");
  }

  return (
    <section aria-labelledby="article-feedback-heading" className="rounded-xl border bg-muted/30 px-5 py-5">
      {stage === "ask" && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 id="article-feedback-heading" className="font-semibold">
            Was this article helpful?
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => vote(true)}>
              <ThumbsUp className="mr-1.5 h-4 w-4" aria-hidden /> Yes
            </Button>
            <Button variant="outline" size="sm" onClick={() => vote(false)}>
              <ThumbsDown className="mr-1.5 h-4 w-4" aria-hidden /> No
            </Button>
          </div>
        </div>
      )}

      {(stage === "comment" || (stage === "sending" && helpful === false)) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(false, comment.trim() || null);
          }}
        >
          <h2 id="article-feedback-heading" className="font-semibold">
            Sorry about that. What were you looking for?
          </h2>
          <label htmlFor="help-feedback-comment" className="sr-only">
            What were you looking for?
          </label>
          <textarea
            id="help-feedback-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Optional — tell us what was missing or unclear."
            className="mt-3 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            We read every response, but can’t reply here. If you need an answer, email{" "}
            <a href={`mailto:${supportEmail}`} className="underline underline-offset-2">
              {supportEmail}
            </a>
            .
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="submit" size="sm" disabled={stage === "sending"}>
              {stage === "sending" ? "Sending…" : "Send feedback"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={stage === "sending"}
              onClick={() => void send(false, null)}
            >
              Skip
            </Button>
          </div>
        </form>
      )}

      {stage === "sending" && helpful === true && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Sending…
        </p>
      )}

      {stage === "done" && (
        <p className="text-sm" aria-live="polite">
          <span className="font-semibold">Thanks for your feedback!</span>{" "}
          <span className="text-muted-foreground">
            {helpful ? "Glad it helped." : "We use it to improve our articles."}
          </span>
        </p>
      )}

      {stage === "error" && (
        <p className="text-sm" aria-live="polite">
          Couldn&apos;t send your feedback.{" "}
          <button
            type="button"
            className="font-medium text-primary underline underline-offset-2"
            onClick={() => (helpful === false ? setStage("comment") : void send(true, null))}
          >
            Try again
          </button>
        </p>
      )}
    </section>
  );
}
