"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Plus, ChevronLeft } from "lucide-react";
import type { ExtractionResult } from "@/lib/validations";

type KanjiItem = ExtractionResult["kanji"][number];
type VocabItem = ExtractionResult["vocabulary"][number];
type SentenceItem = ExtractionResult["sentences"][number];

interface KanjiDraft extends KanjiItem {
  _key: string;
  _selected: boolean;
}
interface VocabDraft extends VocabItem {
  _key: string;
  _selected: boolean;
}
interface SentenceDraft extends SentenceItem {
  _key: string;
  _selected: boolean;
}

export interface SaveResponse {
  success: true;
  sourceImageId: string;
  extracted: {
    kanji: { total: number; new: number; existing: number };
    vocabulary: { total: number; new: number; existing: number };
    sentences: number;
  };
  items: {
    kanji: { text: string; isNew: boolean }[];
    vocabulary: { text: string; reading: string; isNew: boolean }[];
  };
}

interface Props {
  sourceImageId: string;
  extraction: ExtractionResult;
  onSaved: (response: SaveResponse) => void;
  onDiscard: () => void;
  onError: (message: string) => void;
}

function splitList(input: string): string[] {
  return input
    .split(/[,、]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function joinList(values: readonly string[] | null | undefined): string {
  if (!values) return "";
  return values.join(", ");
}

let keyCounter = 0;
const nextKey = () => `k${++keyCounter}`;

export function ExtractionConfirmation({
  sourceImageId,
  extraction,
  onSaved,
  onDiscard,
  onError,
}: Props) {
  const [kanji, setKanji] = useState<KanjiDraft[]>(() =>
    extraction.kanji.map((k) => ({ ...k, _key: nextKey(), _selected: true }))
  );
  const [vocab, setVocab] = useState<VocabDraft[]>(() =>
    extraction.vocabulary.map((v) => ({ ...v, _key: nextKey(), _selected: true }))
  );
  const [sentences, setSentences] = useState<SentenceDraft[]>(() =>
    extraction.sentences.map((s) => ({ ...s, _key: nextKey(), _selected: true }))
  );
  const [saving, setSaving] = useState(false);

  const selectedKanji = useMemo(() => kanji.filter((k) => k._selected), [kanji]);
  const selectedVocab = useMemo(() => vocab.filter((v) => v._selected), [vocab]);
  const selectedSentences = useMemo(
    () => sentences.filter((s) => s._selected),
    [sentences]
  );

  const totalSelected =
    selectedKanji.length + selectedVocab.length + selectedSentences.length;
  const totalItems = kanji.length + vocab.length + sentences.length;

  const updateKanji = (key: string, patch: Partial<KanjiDraft>) =>
    setKanji((prev) => prev.map((k) => (k._key === key ? { ...k, ...patch } : k)));
  const updateVocab = (key: string, patch: Partial<VocabDraft>) =>
    setVocab((prev) => prev.map((v) => (v._key === key ? { ...v, ...patch } : v)));
  const updateSentence = (key: string, patch: Partial<SentenceDraft>) =>
    setSentences((prev) => prev.map((s) => (s._key === key ? { ...s, ...patch } : s)));

  const removeKanji = (key: string) =>
    setKanji((prev) => prev.filter((k) => k._key !== key));
  const removeVocab = (key: string) =>
    setVocab((prev) => prev.filter((v) => v._key !== key));
  const removeSentence = (key: string) =>
    setSentences((prev) => prev.filter((s) => s._key !== key));

  const handleSave = async () => {
    if (totalSelected === 0 || saving) return;
    setSaving(true);

    const sanitizedKanji = selectedKanji
      .map((k) => ({
        character: k.character,
        meanings: k.meanings.filter((m) => m.trim().length > 0),
        readingsOn: k.readingsOn ?? [],
        readingsKun: k.readingsKun ?? [],
        jlptLevel: k.jlptLevel ?? undefined,
        strokeCount: k.strokeCount ?? undefined,
      }))
      .filter((k) => k.meanings.length > 0);

    const sanitizedVocab = selectedVocab
      .map((v) => ({
        word: v.word.trim(),
        reading: v.reading.trim() || "—",
        meanings: v.meanings.filter((m) => m.trim().length > 0),
        partOfSpeech: v.partOfSpeech ?? undefined,
        jlptLevel: v.jlptLevel ?? undefined,
      }))
      .filter((v) => v.word.length > 0 && v.meanings.length > 0);

    const sanitizedSentences = selectedSentences
      .map((s) => ({
        japanese: s.japanese.trim(),
        english: s.english?.trim() || undefined,
      }))
      .filter((s) => s.japanese.length > 0);

    try {
      const response = await fetch("/api/extract/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImageId,
          kanji: sanitizedKanji,
          vocabulary: sanitizedVocab,
          sentences: sanitizedSentences,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save items");
      }

      const data = (await response.json()) as SaveResponse;
      onSaved(data);
    } catch (err) {
      setSaving(false);
      onError(err instanceof Error ? err.message : "Failed to save items");
    }
  };

  return (
    <Card className="jr-panel">
      <CardContent className="py-6 sm:py-8">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h3 className="text-lg font-semibold">Review what we found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Edit any wrong readings or meanings, uncheck what you don&apos;t want,
              then save to your library.
            </p>
          </div>
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="hidden sm:inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground -mr-1 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        <div className="mt-5 space-y-6">
          {kanji.length > 0 && (
            <Section
              title="Kanji"
              count={selectedKanji.length}
              total={kanji.length}
              onSelectAll={() =>
                setKanji((prev) => prev.map((k) => ({ ...k, _selected: true })))
              }
              onDeselectAll={() =>
                setKanji((prev) => prev.map((k) => ({ ...k, _selected: false })))
              }
            >
              {kanji.map((k) => (
                <KanjiRow
                  key={k._key}
                  item={k}
                  disabled={saving}
                  onToggle={() => updateKanji(k._key, { _selected: !k._selected })}
                  onChangeMeanings={(value) =>
                    updateKanji(k._key, { meanings: splitList(value) })
                  }
                  onChangeOn={(value) =>
                    updateKanji(k._key, { readingsOn: splitList(value) })
                  }
                  onChangeKun={(value) =>
                    updateKanji(k._key, { readingsKun: splitList(value) })
                  }
                  onRemove={() => removeKanji(k._key)}
                />
              ))}
            </Section>
          )}

          {vocab.length > 0 && (
            <Section
              title="Vocabulary"
              count={selectedVocab.length}
              total={vocab.length}
              onSelectAll={() =>
                setVocab((prev) => prev.map((v) => ({ ...v, _selected: true })))
              }
              onDeselectAll={() =>
                setVocab((prev) => prev.map((v) => ({ ...v, _selected: false })))
              }
            >
              {vocab.map((v) => (
                <VocabRow
                  key={v._key}
                  item={v}
                  disabled={saving}
                  onToggle={() => updateVocab(v._key, { _selected: !v._selected })}
                  onChangeReading={(value) => updateVocab(v._key, { reading: value })}
                  onChangeMeanings={(value) =>
                    updateVocab(v._key, { meanings: splitList(value) })
                  }
                  onRemove={() => removeVocab(v._key)}
                />
              ))}
            </Section>
          )}

          {sentences.length > 0 && (
            <Section
              title="Sentences"
              count={selectedSentences.length}
              total={sentences.length}
              onSelectAll={() =>
                setSentences((prev) => prev.map((s) => ({ ...s, _selected: true })))
              }
              onDeselectAll={() =>
                setSentences((prev) => prev.map((s) => ({ ...s, _selected: false })))
              }
            >
              {sentences.map((s) => (
                <SentenceRow
                  key={s._key}
                  item={s}
                  disabled={saving}
                  onToggle={() =>
                    updateSentence(s._key, { _selected: !s._selected })
                  }
                  onChangeJapanese={(value) =>
                    updateSentence(s._key, { japanese: value })
                  }
                  onChangeEnglish={(value) =>
                    updateSentence(s._key, { english: value })
                  }
                  onRemove={() => removeSentence(s._key)}
                />
              ))}
            </Section>
          )}

          {totalItems === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nothing left to save. Discard to try again.
            </p>
          )}
        </div>

        <div className="mt-7 flex flex-col-reverse sm:flex-row gap-3 sm:items-center sm:justify-end">
          <Button
            variant="outline"
            onClick={onDiscard}
            disabled={saving}
            className="sm:mr-auto"
          >
            Discard
          </Button>
          <Button onClick={handleSave} disabled={totalSelected === 0 || saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Save {totalSelected} item{totalSelected === 1 ? "" : "s"} to library
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  count,
  total,
  onSelectAll,
  onDeselectAll,
  children,
}: {
  title: string;
  count: number;
  total: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  children: React.ReactNode;
}) {
  const allSelected = count === total && total > 0;
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2 px-0.5">
        <div>
          <span className="font-medium">{title}</span>
          <span className="text-sm text-muted-foreground ml-2">
            {count} of {total}
          </span>
        </div>
        <button
          type="button"
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function CheckToggle({
  checked,
  onClick,
  disabled,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`mt-1 h-5 w-5 flex-shrink-0 rounded flex items-center justify-center transition-colors disabled:opacity-50 ${
        checked
          ? "border-2 border-primary bg-primary text-primary-foreground"
          : "border-2 border-muted-foreground/45 bg-muted/30 shadow-sm hover:border-primary/55 hover:bg-muted/45"
      }`}
    >
      {checked && (
        <svg
          viewBox="0 0 16 16"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      )}
    </button>
  );
}

function RowShell({
  selected,
  checkbox,
  children,
  onRemove,
  disabled,
}: {
  selected: boolean;
  checkbox: React.ReactNode;
  children: React.ReactNode;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`group flex items-start gap-3 px-3 py-2.5 rounded-lg border bg-background ${
        selected ? "border-border" : "border-border/60"
      }`}
    >
      {checkbox}
      <div
        className={`flex flex-1 min-w-0 items-start gap-3 transition-opacity ${
          selected ? "" : "opacity-50"
        }`}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Remove from list"
        className="mt-1 text-muted-foreground/50 hover:text-jr-red opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-30"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function InlineInput({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  monospace,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  monospace?: boolean;
  ariaLabel?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`w-full bg-transparent rounded px-1.5 py-0.5 text-sm placeholder:text-muted-foreground/40 outline-none border border-transparent hover:border-border focus:border-primary/40 focus:bg-muted/30 transition-colors ${
        monospace ? "font-mono" : ""
      } ${className ?? ""}`}
    />
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70 w-12 flex-shrink-0 pt-1">
      {children}
    </span>
  );
}

function KanjiRow({
  item,
  disabled,
  onToggle,
  onChangeMeanings,
  onChangeOn,
  onChangeKun,
  onRemove,
}: {
  item: KanjiDraft;
  disabled?: boolean;
  onToggle: () => void;
  onChangeMeanings: (value: string) => void;
  onChangeOn: (value: string) => void;
  onChangeKun: (value: string) => void;
  onRemove: () => void;
}) {
  return (
    <RowShell
      selected={item._selected}
      onRemove={onRemove}
      disabled={disabled}
      checkbox={
        <CheckToggle
          checked={item._selected}
          onClick={onToggle}
          disabled={disabled}
          label={`Include ${item.character}`}
        />
      }
    >
      <div className="flex items-center justify-center h-12 w-12 flex-shrink-0 rounded-md bg-primary/10 text-primary text-3xl font-medium">
        {item.character}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start gap-2">
          <FieldLabel>Mean</FieldLabel>
          <InlineInput
            value={joinList(item.meanings)}
            onChange={onChangeMeanings}
            placeholder="meaning, meaning"
            disabled={disabled || !item._selected}
            ariaLabel="Meanings"
          />
        </div>
        <div className="flex items-start gap-2">
          <FieldLabel>On</FieldLabel>
          <InlineInput
            value={joinList(item.readingsOn)}
            onChange={onChangeOn}
            placeholder="カタカナ"
            disabled={disabled || !item._selected}
            monospace
            ariaLabel="On readings"
          />
        </div>
        <div className="flex items-start gap-2">
          <FieldLabel>Kun</FieldLabel>
          <InlineInput
            value={joinList(item.readingsKun)}
            onChange={onChangeKun}
            placeholder="ひらがな"
            disabled={disabled || !item._selected}
            monospace
            ariaLabel="Kun readings"
          />
        </div>
      </div>
    </RowShell>
  );
}

function VocabRow({
  item,
  disabled,
  onToggle,
  onChangeReading,
  onChangeMeanings,
  onRemove,
}: {
  item: VocabDraft;
  disabled?: boolean;
  onToggle: () => void;
  onChangeReading: (value: string) => void;
  onChangeMeanings: (value: string) => void;
  onRemove: () => void;
}) {
  return (
    <RowShell
      selected={item._selected}
      onRemove={onRemove}
      disabled={disabled}
      checkbox={
        <CheckToggle
          checked={item._selected}
          onClick={onToggle}
          disabled={disabled}
          label={`Include ${item.word}`}
        />
      }
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="text-lg font-semibold">{item.word}</span>
          <input
            type="text"
            value={item.reading}
            onChange={(e) => onChangeReading(e.target.value)}
            disabled={disabled || !item._selected}
            aria-label="Reading"
            className="bg-transparent rounded px-1.5 py-0.5 text-sm font-mono text-muted-foreground outline-none border border-transparent hover:border-border focus:border-primary/40 focus:bg-muted/30 transition-colors min-w-[5rem] flex-1"
          />
        </div>
        <div className="flex items-start gap-2">
          <FieldLabel>Mean</FieldLabel>
          <InlineInput
            value={joinList(item.meanings)}
            onChange={onChangeMeanings}
            placeholder="meaning, meaning"
            disabled={disabled || !item._selected}
            ariaLabel="Meanings"
          />
        </div>
      </div>
    </RowShell>
  );
}

function SentenceRow({
  item,
  disabled,
  onToggle,
  onChangeJapanese,
  onChangeEnglish,
  onRemove,
}: {
  item: SentenceDraft;
  disabled?: boolean;
  onToggle: () => void;
  onChangeJapanese: (value: string) => void;
  onChangeEnglish: (value: string) => void;
  onRemove: () => void;
}) {
  return (
    <RowShell
      selected={item._selected}
      onRemove={onRemove}
      disabled={disabled}
      checkbox={
        <CheckToggle
          checked={item._selected}
          onClick={onToggle}
          disabled={disabled}
          label="Include sentence"
        />
      }
    >
      <div className="flex-1 min-w-0 space-y-1">
        <textarea
          value={item.japanese}
          onChange={(e) => onChangeJapanese(e.target.value)}
          disabled={disabled || !item._selected}
          aria-label="Japanese sentence"
          rows={1}
          className="w-full bg-transparent rounded px-1.5 py-0.5 text-base resize-none outline-none border border-transparent hover:border-border focus:border-primary/40 focus:bg-muted/30 transition-colors"
        />
        <textarea
          value={item.english ?? ""}
          onChange={(e) => onChangeEnglish(e.target.value)}
          disabled={disabled || !item._selected}
          aria-label="English translation"
          placeholder="English translation (optional)"
          rows={1}
          className="w-full bg-transparent rounded px-1.5 py-0.5 text-sm text-muted-foreground resize-none outline-none border border-transparent hover:border-border focus:border-primary/40 focus:bg-muted/30 transition-colors placeholder:text-muted-foreground/40"
        />
      </div>
    </RowShell>
  );
}
