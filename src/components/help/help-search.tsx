"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Search, X } from "lucide-react";
import type { HelpSearchEntry } from "@/lib/help-center";
import { highlightParts, searchHelp, tokenize } from "@/lib/help-search";
import { cn } from "@/lib/utils";

interface HelpSearchProps {
  index: HelpSearchEntry[];
  size?: "lg" | "sm";
  autoFocus?: boolean;
  supportEmail: string;
}

function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlightParts(text, terms).map((part, i) =>
        part.match ? (
          <mark key={i} className="bg-primary/15 text-foreground rounded-sm px-0.5">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

export function HelpSearch({ index, size = "lg", autoFocus, supportEmail }: HelpSearchProps) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const terms = useMemo(() => tokenize(query), [query]);
  const results = useMemo(() => searchHelp(index, query), [index, query]);
  const showPanel = open && terms.length > 0;

  // "/" focuses search from anywhere on the page, like most help centers.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onPointer(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const hit = results[active];
      if (hit) {
        e.preventDefault();
        setOpen(false);
        router.push(`/help/${hit.entry.slug}`);
      }
    } else if (e.key === "Escape") {
      if (query) setQuery("");
      else inputRef.current?.blur();
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border bg-background shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-primary/30",
          size === "lg" ? "h-14 px-4" : "h-10 px-3",
        )}
      >
        <Search className={cn("shrink-0 text-muted-foreground", size === "lg" ? "h-5 w-5" : "h-4 w-4")} aria-hidden />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="Search help articles"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-activedescendant={showPanel && results[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={size === "lg" ? "Search for answers — e.g. “cancel”, “streak”, “delete a card”" : "Search help"}
          className={cn(
            "flex-1 min-w-0 bg-transparent outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden",
            size === "lg" ? "text-base" : "text-sm",
          )}
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex h-6 items-center rounded border bg-muted px-1.5 font-mono text-xs text-muted-foreground">
            /
          </kbd>
        )}
      </div>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-xl border bg-background text-left shadow-lg">
          {results.length > 0 ? (
            <ul id={listId} role="listbox" aria-label="Search results" className="max-h-[60vh] overflow-y-auto py-1.5">
              {results.map((r, i) => (
                <li key={r.entry.slug} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                  <Link
                    href={`/help/${r.entry.slug}`}
                    onClick={() => setOpen(false)}
                    onMouseEnter={() => setActive(i)}
                    className={cn("flex gap-3 px-4 py-3", i === active && "bg-muted")}
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        <Highlighted text={r.entry.title} terms={terms} />
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
                        <Highlighted text={r.snippet} terms={terms} />
                      </span>
                      <span className="mt-1 block text-[11px] uppercase tracking-wide text-muted-foreground/80">
                        {r.entry.categoryTitle}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-5 text-sm">
              <p className="font-medium">No articles match “{query.trim()}”.</p>
              <p className="mt-1 text-muted-foreground">
                Try different words, or{" "}
                <a href={`mailto:${supportEmail}`} className="font-medium text-primary underline underline-offset-2">
                  email support
                </a>
                .
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
