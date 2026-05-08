'use client';

import { useState, useTransition } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import type { SourceWithProgress } from '@/lib/sources-progress';

interface SourcesProgressProps {
  sources: SourceWithProgress[];
}

export function SourcesProgress({ sources: initial }: SourcesProgressProps) {
  const [sources, setSources] = useState(initial);

  if (sources.length === 0) return null;

  return (
    <section className="stagger-1 pt-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="floor-label floor-label-primary">Your Materials</h2>
        <span className="text-[10px] text-muted-foreground">
          how each captured page is coming along
        </span>
      </div>

      <ul className="space-y-3">
        {sources.map((source) => (
          <SourceRow
            key={source.id}
            source={source}
            onRenamed={(name) =>
              setSources((prev) =>
                prev.map((s) => (s.id === source.id ? { ...s, name } : s)),
              )
            }
          />
        ))}
      </ul>
    </section>
  );
}

interface SourceRowProps {
  source: SourceWithProgress;
  onRenamed: (name: string) => void;
}

function SourceRow({ source, onRenamed }: SourceRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(source.name);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const { progress } = source;
  const { breakdown } = progress;
  const knownPct = breakdown.total > 0
    ? Math.round((breakdown.known / breakdown.total) * 100)
    : 0;

  function commitRename() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === source.name) {
      setEditing(false);
      setDraft(source.name);
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/sources/${source.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });
        if (!res.ok) throw new Error('rename failed');
        onRenamed(trimmed);
        setEditing(false);
        setError(null);
      } catch {
        setError('Could not save');
      }
    });
  }

  function cancelRename() {
    setDraft(source.name);
    setEditing(false);
    setError(null);
  }

  return (
    <li className="window-pane p-4">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') cancelRename();
                }}
                autoFocus
                disabled={pending}
                maxLength={80}
                className="flex-1 min-w-0 text-sm font-semibold bg-transparent border-b border-border focus:border-foreground outline-none px-0.5 py-0.5"
                aria-label="Source name"
              />
              <button
                type="button"
                onClick={commitRename}
                disabled={pending}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Save name"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={cancelRename}
                disabled={pending}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="group inline-flex items-baseline gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors text-left max-w-full"
              aria-label="Rename source"
            >
              <span className="truncate">{source.name}</span>
              <Pencil className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
            </button>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
          {breakdown.known}/{breakdown.total} kanji
        </span>
      </div>

      <ProgressBar breakdown={breakdown} />

      <div className="flex items-baseline justify-between gap-2 mt-2">
        <span className="text-[11px] text-foreground font-medium">
          {progress.tierLabel}
        </span>
        <span className="text-[11px] text-muted-foreground italic">
          {progress.encouragement}
        </span>
      </div>

      {error && (
        <p className="text-[11px] text-orange-500 mt-1">{error}</p>
      )}

      <p className="sr-only">
        {knownPct}% of kanji from this source feel comfortable.
      </p>
    </li>
  );
}

function ProgressBar({
  breakdown,
}: {
  breakdown: { total: number; new: number; learning: number; reviewing: number; known: number };
}) {
  const t = breakdown.total || 1;
  const segments = [
    { key: 'known', pct: (breakdown.known / t) * 100, className: 'srs-known' },
    { key: 'reviewing', pct: (breakdown.reviewing / t) * 100, className: 'srs-master' },
    { key: 'learning', pct: (breakdown.learning / t) * 100, className: 'srs-guru' },
    { key: 'new', pct: (breakdown.new / t) * 100, className: 'srs-apprentice' },
  ];

  return (
    <div
      className="h-2 w-full rounded-full overflow-hidden flex bg-secondary"
      role="img"
      aria-label="Progress through this source's kanji"
    >
      {segments.map((s) =>
        s.pct > 0 ? (
          <span
            key={s.key}
            className={s.className}
            style={{ width: `${s.pct}%`, height: '100%', display: 'block' }}
          />
        ) : null,
      )}
    </div>
  );
}
