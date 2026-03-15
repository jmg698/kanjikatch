"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Search, X, Loader2, GraduationCap, ArrowUpDown, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SentenceDisplay, type DifficultyRating } from "./sentence-display";
import type { WildSentenceData } from "./in-the-wild";
import Link from "next/link";

const SORT_OPTIONS = [
  { value: "recent", label: "Recently added" },
  { value: "oldest", label: "Oldest first" },
  { value: "alphabetical", label: "Alphabetical" },
] as const;

interface SentenceLibraryProps {
  hasAnySentences: boolean;
}

export function SentenceLibrary({ hasAnySentences }: SentenceLibraryProps) {
  const [sentences, setSentences] = useState<WildSentenceData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [ratings, setRatings] = useState<Record<string, DifficultyRating>>({});

  const sortMenuRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    }
    if (showSortMenu) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showSortMenu]);

  const handleRate = useCallback(async (sentenceId: string, rating: DifficultyRating) => {
    setRatings((prev) => ({ ...prev, [sentenceId]: rating }));

    try {
      await fetch("/api/sentences/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentenceId, rating }),
      });
    } catch {
      // Optimistic — silent fail
    }
  }, []);

  const fetchSentences = useCallback(async (query: string, sort: string, pageNum: number, append = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!append) setLoading(true);

    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: "20", sort });
      if (query) params.set("q", query);

      const res = await fetch(`/api/sentences/library?${params}`, { signal: controller.signal });
      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();

      const fetched: WildSentenceData[] = data.sentences || [];
      setSentences((prev) => append ? [...prev, ...fetched] : fetched);
      setHasMore(data.hasMore);
      setTotal(data.total ?? 0);
      setPage(pageNum);

      const newRatings: Record<string, DifficultyRating> = {};
      for (const s of fetched) {
        if (s.difficultyRating) newRatings[s.id] = s.difficultyRating;
      }
      if (Object.keys(newRatings).length > 0) {
        setRatings((prev) => append ? { ...prev, ...newRatings } : newRatings);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      console.error("Failed to fetch library:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAnySentences) {
      fetchSentences(debouncedQuery, sortBy, 1);
    } else {
      setLoading(false);
    }
  }, [hasAnySentences, debouncedQuery, sortBy, fetchSentences]);

  const handleLoadMore = () => {
    fetchSentences(debouncedQuery, sortBy, page + 1, true);
  };

  const hasActiveFilters = !!(searchQuery || sortBy !== "recent");
  const currentSortLabel = SORT_OPTIONS.find((s) => s.value === sortBy)?.label || "Recently added";

  if (!hasAnySentences) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sentence Library</h1>
          <p className="text-muted-foreground mt-1">
            Your personal collection of contextual Japanese sentences.
          </p>
        </div>

        <Card className="jr-panel">
          <CardContent className="py-12">
            <div className="text-center">
              <BookOpen className="h-16 w-16 mx-auto mb-4 text-primary opacity-40" />
              <h3 className="text-xl font-semibold">No sentences yet</h3>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                Complete a review session to generate your first contextual sentences.
                Each session creates natural Japanese using the items you practiced.
              </p>
              <Button asChild className="mt-6">
                <Link href="/review">
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Start a Review
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sentence Library</h1>
        <p className="text-muted-foreground mt-1">
          Your personal collection of contextual Japanese sentences.
          {!loading && (
            <span className="ml-1">{total} sentences</span>
          )}
        </p>
      </div>

      {/* Search + Sort Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Japanese, English, or target word..."
            className="w-full h-10 pl-9 pr-9 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="relative" ref={sortMenuRef}>
          <Button
            variant="outline"
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex-shrink-0 gap-1.5"
          >
            <ArrowUpDown className="h-4 w-4" />
            <span className="hidden sm:inline">{currentSortLabel}</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
          {showSortMenu && (
            <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-md border bg-popover p-1 shadow-md">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setSortBy(opt.value);
                    setShowSortMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-sm transition-colors ${
                    sortBy === opt.value
                      ? "bg-accent text-accent-foreground font-medium"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Results count when filtering */}
      {!loading && hasActiveFilters && (
        <p className="text-sm text-muted-foreground">
          {total} {total === 1 ? "result" : "results"}
          {debouncedQuery && ` for "${debouncedQuery}"`}
        </p>
      )}

      {/* Sentence list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sentences.length === 0 ? (
        <Card className="jr-panel">
          <CardContent className="py-8 text-center">
            <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground">
              {hasActiveFilters
                ? "No sentences match your search."
                : "No sentences yet"
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {sentences.map((sentence, i) => (
              <motion.div
                key={sentence.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.3) }}
              >
                <Card className="jr-panel overflow-hidden">
                  <CardContent className="py-5 px-6">
                    <SentenceDisplay
                      sentence={sentence}
                      showAddWord
                      compact
                      onRate={handleRate}
                      currentRating={ratings[sentence.id] || null}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          {hasMore && (
            <div className="text-center py-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
              >
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
