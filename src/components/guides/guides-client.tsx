"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  NotebookPen, Plus, Loader2, ChevronRight, Camera, X, Check,
} from "lucide-react";

interface GuideListItem {
  id: string;
  title: string;
  createdAt: string;
  sourceNames: string[];
}

interface SourceOption {
  id: string;
  name: string;
  uploadedAt: string;
}

interface GuidesClientProps {
  guides: GuideListItem[];
}

const MAX_SOURCES_PER_GUIDE = 10;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function GuidesClient({ guides }: GuidesClientProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sources, setSources] = useState<SourceOption[] | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const openPicker = async () => {
    setPickerOpen(true);
    setSelected(new Set());
    if (sources !== null) return;
    setSourcesLoading(true);
    try {
      const res = await fetch("/api/sources");
      if (!res.ok) throw new Error("Failed to load captures");
      const data = await res.json();
      setSources(
        (data.sources as SourceOption[]).map((s) => ({
          id: s.id,
          name: s.name,
          uploadedAt: s.uploadedAt,
        })),
      );
    } catch {
      toast({
        title: "Couldn't load your captures",
        description: "Please try again.",
        variant: "destructive",
      });
      setPickerOpen(false);
    } finally {
      setSourcesLoading(false);
    }
  };

  const toggleSource = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SOURCES_PER_GUIDE) {
        next.add(id);
      }
      return next;
    });
  };

  const generate = async () => {
    if (selected.size === 0 || generating) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/guides/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceImageIds: Array.from(selected) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate the study guide");
      }
      router.push(`/guides/${data.guide.id}`);
    } catch (err) {
      setGenerating(false);
      toast({
        title: "Couldn't create the study guide",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (generating) {
    return (
      <Card className="jr-panel">
        <CardContent className="py-16">
          <div className="text-center max-w-sm mx-auto">
            <Loader2 className="h-10 w-10 mx-auto mb-4 animate-spin text-primary" />
            <h3 className="text-lg font-semibold">Writing your study guide</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Vocabulary tables, grammar notes, kanji breakdown, and practice
              exercises. This usually takes under a minute.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Study Guides</h1>
          <p className="text-muted-foreground mt-1">
            Full lesson handouts built from your captures — grammar, vocab,
            kanji, and practice.
          </p>
        </div>
        {guides.length > 0 && !pickerOpen && (
          <Button onClick={openPicker} className="flex-shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            New guide
          </Button>
        )}
      </div>

      {pickerOpen && (
        <Card className="jr-panel">
          <CardContent className="py-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="font-semibold">Choose captures</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Pick one lesson&apos;s slides, or combine a week of captures into
                  one guide{selected.size > 0 ? ` · ${selected.size} selected` : ""}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                aria-label="Close picker"
                className="text-muted-foreground hover:text-foreground mt-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {sourcesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sources && sources.length > 0 ? (
              <>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {sources.map((s) => {
                    const isSelected = selected.has(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSource(s.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                          isSelected
                            ? "border-primary/50 bg-primary/5"
                            : "border-border/60 hover:border-border bg-background"
                        }`}
                      >
                        <span
                          className={`h-5 w-5 flex-shrink-0 rounded flex items-center justify-center border-2 ${
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/45 bg-muted/30"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium truncate">{s.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {formatDate(s.uploadedAt)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button onClick={generate} disabled={selected.size === 0}>
                    <NotebookPen className="h-4 w-4 mr-2" />
                    Generate guide
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">
                  No captures yet — photograph your class notes first.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/capture">
                    <Camera className="h-4 w-4 mr-2" />
                    Capture notes
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {guides.length === 0 && !pickerOpen ? (
        <Card className="jr-panel">
          <CardContent className="py-12">
            <div className="text-center max-w-md mx-auto">
              <NotebookPen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <h3 className="font-semibold">No study guides yet</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Turn any capture into a full study guide — vocabulary tables,
                grammar patterns with examples, a kanji breakdown by JLPT level,
                and practice exercises with an answer key.
              </p>
              <div className="mt-5 flex gap-3 justify-center">
                <Button onClick={openPicker}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create from captures
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/capture">
                    <Camera className="h-4 w-4 mr-2" />
                    Capture notes
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {guides.map((g) => (
            <Link key={g.id} href={`/guides/${g.id}`} className="block group">
              <Card className="jr-panel transition-colors group-hover:border-primary/40">
                <CardContent className="py-4 flex items-center gap-4">
                  <div className="h-10 w-10 flex-shrink-0 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <NotebookPen className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{g.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {formatDate(g.createdAt)}
                      {g.sourceNames.length > 0 && ` · from ${g.sourceNames.join(", ")}`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0 group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
