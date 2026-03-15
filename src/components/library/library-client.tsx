"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  SlidersHorizontal,
  X,
  Loader2,
  ChevronDown,
  ArrowUpDown,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Kanji, Vocabulary, Sentence } from "@/db/schema";

type Tab = "kanji" | "vocabulary" | "sentences";
type ConfidenceLevel = "new" | "learning" | "reviewing" | "known";

const SORT_OPTIONS = [
  { value: "recent", label: "Recently seen" },
  { value: "oldest", label: "Oldest first" },
  { value: "alphabetical", label: "Alphabetical" },
  { value: "next_review", label: "Next review" },
  { value: "jlpt_asc", label: "JLPT N5 → N1" },
  { value: "jlpt_desc", label: "JLPT N1 → N5" },
] as const;

const SENTENCE_SORT_OPTIONS = [
  { value: "recent", label: "Recently added" },
  { value: "oldest", label: "Oldest first" },
  { value: "alphabetical", label: "Alphabetical" },
] as const;

const JLPT_LEVELS = [5, 4, 3, 2, 1] as const;

const STAGE_CONFIG: Record<ConfidenceLevel, { label: string; color: string }> = {
  new: { label: "New", color: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300" },
  learning: { label: "Learning", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  reviewing: { label: "Reviewing", color: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  known: { label: "Known", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
};

interface LibraryClientProps {
  initialCounts: { kanji: number; vocabulary: number; sentences: number };
}

interface FetchState {
  items: (Kanji | Vocabulary | Sentence)[];
  total: number;
  loading: boolean;
  page: number;
  hasMore: boolean;
}

export function LibraryClient({ initialCounts }: LibraryClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("kanji");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [jlptFilters, setJlptFilters] = useState<number[]>([]);
  const [stageFilters, setStageFilters] = useState<ConfidenceLevel[]>([]);
  const [sortBy, setSortBy] = useState("recent");
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [counts, setCounts] = useState(initialCounts);

  const [fetchState, setFetchState] = useState<FetchState>({
    items: [],
    total: 0,
    loading: true,
    page: 1,
    hasMore: false,
  });

  const sortMenuRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close sort menu on outside click
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

  const fetchItems = useCallback(
    async (tab: Tab, query: string, jlpt: number[], stages: ConfidenceLevel[], sort: string, page: number, append = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (!append) {
        setFetchState((prev) => ({ ...prev, loading: true }));
      }

      try {
        const params = new URLSearchParams({ tab, sort, page: String(page), limit: "50" });
        if (query) params.set("q", query);
        if (jlpt.length > 0) params.set("jlpt", jlpt.join(","));
        if (stages.length > 0) params.set("stage", stages.join(","));

        const res = await fetch(`/api/library?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Fetch failed");

        const data = await res.json();

        setFetchState((prev) => ({
          items: append ? [...prev.items, ...data.items] : data.items,
          total: data.total,
          loading: false,
          page,
          hasMore: data.hasMore,
        }));

        if (!append) {
          setCounts((prev) => ({ ...prev, [tab]: data.total }));
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Library fetch error:", err);
        setFetchState((prev) => ({ ...prev, loading: false }));
      }
    },
    [],
  );

  // Fetch on filter/tab/sort changes
  useEffect(() => {
    fetchItems(activeTab, debouncedQuery, jlptFilters, stageFilters, sortBy, 1);
  }, [activeTab, debouncedQuery, jlptFilters, stageFilters, sortBy, fetchItems]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as Tab);
    setSearchQuery("");
    setDebouncedQuery("");
    setJlptFilters([]);
    setStageFilters([]);
    setSortBy("recent");
  };

  const toggleJlpt = (level: number) => {
    setJlptFilters((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level],
    );
  };

  const toggleStage = (stage: ConfidenceLevel) => {
    setStageFilters((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage],
    );
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setDebouncedQuery("");
    setJlptFilters([]);
    setStageFilters([]);
    setSortBy("recent");
  };

  const hasActiveFilters = !!(searchQuery || jlptFilters.length > 0 || stageFilters.length > 0 || sortBy !== "recent");

  const loadMore = () => {
    fetchItems(activeTab, debouncedQuery, jlptFilters, stageFilters, sortBy, fetchState.page + 1, true);
  };

  const sortOptions = activeTab === "sentences" ? SENTENCE_SORT_OPTIONS : SORT_OPTIONS;
  const currentSortLabel = sortOptions.find((s) => s.value === sortBy)?.label || "Recently seen";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Library</h1>
        <p className="text-muted-foreground mt-1">
          Browse your collected kanji, vocabulary, and sentences.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="kanji">Kanji ({counts.kanji})</TabsTrigger>
          <TabsTrigger value="vocabulary">Vocabulary ({counts.vocabulary})</TabsTrigger>
          <TabsTrigger value="sentences">Sentences ({counts.sentences})</TabsTrigger>
        </TabsList>

        {/* Search + Filter Bar */}
        <div className="space-y-3">
          <div className="flex gap-2">
            {/* Search input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === "kanji"
                    ? "Search by character, reading, or meaning..."
                    : activeTab === "vocabulary"
                      ? "Search by word, reading, or meaning..."
                      : "Search by Japanese or English..."
                }
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

            {/* Filter toggle (kanji/vocab only) */}
            {activeTab !== "sentences" && (
              <Button
                variant={showFilters ? "default" : "outline"}
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className="flex-shrink-0"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            )}

            {/* Sort dropdown */}
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
                  {sortOptions.map((opt) => (
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

          {/* Filter chips panel */}
          <AnimatePresence>
            {showFilters && activeTab !== "sentences" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  {/* JLPT Level filter */}
                  <div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      JLPT Level
                    </span>
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      {JLPT_LEVELS.map((level) => (
                        <button
                          key={level}
                          onClick={() => toggleJlpt(level)}
                          className={`px-3 py-1.5 rounded-full text-sm font-mono font-medium transition-colors ${
                            jlptFilters.includes(level)
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          N{level}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SRS Stage filter */}
                  <div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      SRS Stage
                    </span>
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      {(Object.keys(STAGE_CONFIG) as ConfidenceLevel[]).map((stage) => {
                        const config = STAGE_CONFIG[stage];
                        const isActive = stageFilters.includes(stage);
                        return (
                          <button
                            key={stage}
                            onClick={() => toggleStage(stage)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                              isActive
                                ? "bg-primary text-primary-foreground"
                                : `${config.color} hover:opacity-80`
                            }`}
                          >
                            {config.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Clear all */}
                  {hasActiveFilters && (
                    <div className="pt-1">
                      <button
                        onClick={clearAllFilters}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        <X className="h-3 w-3" />
                        Clear all filters
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active filter summary (when filter panel is closed) */}
          {!showFilters && (jlptFilters.length > 0 || stageFilters.length > 0) && (
            <div className="flex items-center gap-2 flex-wrap">
              {jlptFilters.map((level) => (
                <span
                  key={`jlpt-${level}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-primary/10 text-primary"
                >
                  N{level}
                  <button onClick={() => toggleJlpt(level)} className="hover:text-primary/70">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {stageFilters.map((stage) => (
                <span
                  key={`stage-${stage}`}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STAGE_CONFIG[stage].color}`}
                >
                  {STAGE_CONFIG[stage].label}
                  <button onClick={() => toggleStage(stage)} className="hover:opacity-70">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={clearAllFilters}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Results count */}
        {!fetchState.loading && hasActiveFilters && (
          <p className="text-sm text-muted-foreground">
            {fetchState.total} {fetchState.total === 1 ? "result" : "results"}
            {debouncedQuery && ` for "${debouncedQuery}"`}
          </p>
        )}

        {/* Tab content */}
        <TabsContent value="kanji" className="space-y-4 mt-0">
          <ItemList
            loading={fetchState.loading}
            items={fetchState.items}
            hasMore={fetchState.hasMore}
            onLoadMore={loadMore}
            emptyMessage="No kanji yet. Capture an image to start building your collection!"
            emptyFilterMessage="No kanji match your filters."
            hasActiveFilters={hasActiveFilters}
            renderItem={(item) => <KanjiCard kanji={item as Kanji} />}
          />
        </TabsContent>

        <TabsContent value="vocabulary" className="space-y-4 mt-0">
          <ItemList
            loading={fetchState.loading}
            items={fetchState.items}
            hasMore={fetchState.hasMore}
            onLoadMore={loadMore}
            emptyMessage="No vocabulary yet. Capture an image to start building your collection!"
            emptyFilterMessage="No vocabulary matches your filters."
            hasActiveFilters={hasActiveFilters}
            renderItem={(item) => <VocabCard vocab={item as Vocabulary} />}
          />
        </TabsContent>

        <TabsContent value="sentences" className="space-y-4 mt-0">
          <ItemList
            loading={fetchState.loading}
            items={fetchState.items}
            hasMore={fetchState.hasMore}
            onLoadMore={loadMore}
            emptyMessage="No sentences yet. Capture an image to start building your collection!"
            emptyFilterMessage="No sentences match your search."
            hasActiveFilters={hasActiveFilters}
            renderItem={(item) => <SentenceCard sentence={item as Sentence} />}
            listMode
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ──

function ItemList({
  loading,
  items,
  hasMore,
  onLoadMore,
  emptyMessage,
  emptyFilterMessage,
  hasActiveFilters,
  renderItem,
  listMode = false,
}: {
  loading: boolean;
  items: unknown[];
  hasMore: boolean;
  onLoadMore: () => void;
  emptyMessage: string;
  emptyFilterMessage: string;
  hasActiveFilters: boolean;
  renderItem: (item: unknown) => React.ReactNode;
  listMode?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="jr-panel">
        <CardContent className="py-8 text-center">
          <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-muted-foreground">
            {hasActiveFilters ? emptyFilterMessage : emptyMessage}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className={listMode ? "space-y-4" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
        <AnimatePresence mode="popLayout">
          {items.map((item, i) => (
            <motion.div
              key={(item as { id: string }).id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: Math.min(i * 0.02, 0.2) }}
            >
              {renderItem(item)}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {hasMore && (
        <div className="text-center py-4">
          <Button variant="outline" onClick={onLoadMore}>
            Load more
          </Button>
        </div>
      )}
    </>
  );
}

function StageBadge({ level }: { level: string }) {
  const config = STAGE_CONFIG[level as ConfidenceLevel];
  if (!config) return null;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

function KanjiCard({ kanji: k }: { kanji: Kanji }) {
  return (
    <Card className="jr-panel">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold">{k.character}</span>
            {k.timesSeen > 1 && (
              <span className="text-xs text-muted-foreground">×{k.timesSeen}</span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {k.jlptLevel && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-mono font-medium">
                N{k.jlptLevel}
              </span>
            )}
            <StageBadge level={k.confidenceLevel} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="font-medium">{k.meanings.join(", ")}</p>
        {k.readingsOn.length > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">On:</span> {k.readingsOn.join(", ")}
          </p>
        )}
        {k.readingsKun.length > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Kun:</span> {k.readingsKun.join(", ")}
          </p>
        )}
        {k.strokeCount && (
          <p className="text-xs text-muted-foreground">{k.strokeCount} strokes</p>
        )}
      </CardContent>
    </Card>
  );
}

function VocabCard({ vocab: v }: { vocab: Vocabulary }) {
  return (
    <Card className="jr-panel">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <CardTitle className="text-2xl">{v.word}</CardTitle>
              {v.timesSeen > 1 && (
                <span className="text-xs text-muted-foreground">×{v.timesSeen}</span>
              )}
            </div>
            <CardDescription>{v.reading}</CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            {v.jlptLevel && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-mono font-medium">
                N{v.jlptLevel}
              </span>
            )}
            <StageBadge level={v.confidenceLevel} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="font-medium">{v.meanings.join(", ")}</p>
        {v.partOfSpeech && (
          <p className="text-xs text-muted-foreground">{v.partOfSpeech}</p>
        )}
      </CardContent>
    </Card>
  );
}

function SentenceCard({ sentence: s }: { sentence: Sentence }) {
  return (
    <Card className="jr-panel">
      <CardContent className="py-4 space-y-2">
        <p className="text-xl">{s.japanese}</p>
        {s.english && <p className="font-medium">{s.english}</p>}
        <p className="text-xs text-muted-foreground">Source: {s.source}</p>
      </CardContent>
    </Card>
  );
}
