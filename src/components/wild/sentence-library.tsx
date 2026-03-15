"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Filter, X, Loader2, GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SentenceDisplay, type DifficultyRating } from "./sentence-display";
import type { WildSentenceData } from "./in-the-wild";
import Link from "next/link";

interface FilterOption {
  itemText: string;
  itemType: string;
}

interface SentenceLibraryProps {
  hasAnySentences: boolean;
}

export function SentenceLibrary({ hasAnySentences }: SentenceLibraryProps) {
  const [sentences, setSentences] = useState<WildSentenceData[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOption[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [ratings, setRatings] = useState<Record<string, DifficultyRating>>({});

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

  const fetchSentences = useCallback(async (pageNum: number, filter: string | null, append: boolean = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: "20" });
      if (filter) params.set("item", filter);

      const res = await fetch(`/api/sentences/library?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();

      const fetched: WildSentenceData[] = data.sentences || [];
      setSentences((prev) => append ? [...prev, ...fetched] : fetched);
      setFilterOptions(data.filterOptions || []);
      setHasMore(data.hasMore);
      setPage(pageNum);

      const newRatings: Record<string, DifficultyRating> = {};
      for (const s of fetched) {
        if (s.difficultyRating) newRatings[s.id] = s.difficultyRating;
      }
      if (Object.keys(newRatings).length > 0) {
        setRatings((prev) => append ? { ...prev, ...newRatings } : newRatings);
      }
    } catch (e) {
      console.error("Failed to fetch library:", e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (hasAnySentences) {
      fetchSentences(1, null);
    } else {
      setLoading(false);
    }
  }, [hasAnySentences, fetchSentences]);

  const handleFilter = (item: string | null) => {
    setActiveFilter(item);
    fetchSentences(1, item);
  };

  const handleLoadMore = () => {
    fetchSentences(page + 1, activeFilter, true);
  };

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
          {sentences.length > 0 && !loading && (
            <span className="ml-1">
              {activeFilter ? `Showing sentences with "${activeFilter}"` : `${sentences.length}${hasMore ? "+" : ""} sentences`}
            </span>
          )}
        </p>
      </div>

      {/* Filter chips */}
      {filterOptions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <button
            onClick={() => handleFilter(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !activeFilter
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All
          </button>
          {filterOptions.map((opt) => (
            <button
              key={opt.itemText}
              onClick={() => handleFilter(activeFilter === opt.itemText ? null : opt.itemText)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeFilter === opt.itemText
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {opt.itemText}
              {activeFilter === opt.itemText && (
                <X className="h-3 w-3 ml-1 inline" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Sentence list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sentences.length === 0 ? (
        <Card className="jr-panel">
          <CardContent className="py-8 text-center text-muted-foreground">
            {activeFilter
              ? `No sentences found targeting "${activeFilter}"`
              : "No sentences yet"
            }
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
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load More"
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
