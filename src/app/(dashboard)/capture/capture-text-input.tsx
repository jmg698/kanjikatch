"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertCircle, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type InputState = "idle" | "processing" | "success" | "error";

export function CaptureTextInput() {
  const [state, setState] = useState<InputState>("idle");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setState("processing");

    try {
      const response = await fetch("/api/extract-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to process text");
      }

      setState("success");
      toast({
        title: "Success!",
        description: "Your text has been processed and content extracted.",
      });

      setTimeout(() => {
        router.push("/library");
        router.refresh();
      }, 1500);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "An error occurred");
      toast({
        title: "Error",
        description: "Failed to process your text. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (state === "processing") {
    return (
      <Card className="jr-panel">
        <CardContent className="py-12">
          <div className="text-center">
            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
            <h3 className="text-lg font-semibold">Processing your text...</h3>
            <p className="text-muted-foreground mt-2">
              AI is extracting kanji, vocabulary, and sentences.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state === "success") {
    return (
      <Card className="jr-panel">
        <CardContent className="py-12">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold">Success!</h3>
            <p className="text-muted-foreground mt-2">
              Redirecting to your library...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state === "error") {
    return (
      <Card className="jr-panel">
        <CardContent className="py-12">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-jr-red" />
            <h3 className="text-lg font-semibold">Something went wrong</h3>
            <p className="text-muted-foreground mt-2">{error}</p>
            <Button
              className="mt-4"
              onClick={() => {
                setState("idle");
                setError(null);
              }}
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="jr-panel">
      <CardHeader>
        <CardTitle>Paste Text</CardTitle>
        <CardDescription>
          Paste your Japanese notes, vocabulary lists, or sentences below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={"例: 学生がたくさんいます。\n\n学 - study, learning\n生 - life, birth\n学生 (がくせい) - student"}
          className="w-full min-h-[200px] rounded-lg border border-border bg-background px-4 py-3 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {text.length > 0 ? `${text.length.toLocaleString()} characters` : "⌘+Enter to submit"}
          </p>
          <Button
            onClick={handleSubmit}
            disabled={text.trim().length === 0}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Extract Content
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
