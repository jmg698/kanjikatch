"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUploadThing, getUploadThingPublicUrl } from "@/lib/uploadthing";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2, Check, CheckCircle, AlertCircle, Upload, X,
  Image as ImageIcon, Camera, Type, ChevronLeft, SearchX,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ExtractionResult } from "@/lib/validations";
import { ExtractionConfirmation, type SaveResponse } from "./extraction-confirmation";
import { cn } from "@/lib/utils";

const CAPTURE_STAGES_IMAGE: readonly { title: string; subtitle: string }[] = [
  { title: "Sending your image", subtitle: "Kanji Katch is uploading it securely." },
  { title: "Reading your image", subtitle: "Kanji Katch is pulling every line of Japanese from your photo." },
  { title: "Finding kanji and vocabulary", subtitle: "Kanji Katch is spotting characters and compound words." },
  { title: "Looking up readings", subtitle: "Kanji Katch is matching readings and your library." },
];

const CAPTURE_STAGES_TEXT: readonly { title: string; subtitle: string }[] = [
  { title: "Reading your text", subtitle: "Kanji Katch is scanning what you pasted." },
  { title: "Finding kanji and vocabulary", subtitle: "Kanji Katch is spotting characters and compound words." },
  { title: "Looking up readings", subtitle: "Kanji Katch is matching readings and your library." },
];

type InputMode = "empty" | "text" | "image";
type ProcessState =
  | "idle"
  | "uploading"
  | "processing"
  | "confirming"
  | "empty"
  | "success"
  | "error";

interface ExtractionCounts {
  kanji: { total: number; new: number; existing: number };
  vocabulary: { total: number; new: number; existing: number };
  sentences: number;
}

interface ExtractedItems {
  kanji: { text: string; isNew: boolean }[];
  vocabulary: { text: string; reading: string; isNew: boolean }[];
}

interface ExtractionResponse {
  extracted: ExtractionCounts;
  items: ExtractedItems;
}

interface ExtractDraft {
  sourceImageId: string;
  extraction: ExtractionResult;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function CaptureInput() {
  const [mode, setMode] = useState<InputMode>("empty");
  const [state, setState] = useState<ProcessState>("idle");
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] = useState<ExtractionResponse | null>(null);
  const [draft, setDraft] = useState<ExtractDraft | null>(null);
  const [mobileTextMode, setMobileTextMode] = useState(false);
  const [submissionKind, setSubmissionKind] = useState<"image" | "text">("text");
  const [captureStageIndex, setCaptureStageIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const router = useRouter();
  const { toast } = useToast();

  const stages =
    submissionKind === "image" ? CAPTURE_STAGES_IMAGE : CAPTURE_STAGES_TEXT;

  useEffect(() => {
    if (state === "uploading") {
      setCaptureStageIndex(0);
      return;
    }
    if (state !== "processing") return;

    if (submissionKind === "image") {
      setCaptureStageIndex(1);
      const t1 = setTimeout(() => setCaptureStageIndex(2), 4800);
      const t2 = setTimeout(() => setCaptureStageIndex(3), 9600);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    setCaptureStageIndex(0);
    const t1 = setTimeout(() => setCaptureStageIndex(1), 4200);
    const t2 = setTimeout(() => setCaptureStageIndex(2), 8400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [state, submissionKind]);

  const { startUpload } = useUploadThing("imageUploader", {
    onUploadError: (err) => {
      setState("error");
      setError(err.message);
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const loadImage = useCallback((file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please use JPEG, PNG, or WebP images.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Images must be under 4MB.",
        variant: "destructive",
      });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setMode("image");
    setText("");
  }, [toast]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) loadImage(files[0]);
  }, [loadImage]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) loadImage(files[0]);
    e.target.value = "";
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => ACCEPTED_TYPES.includes(item.type));
    if (imageItem) {
      e.preventDefault();
      e.stopPropagation();
      const file = imageItem.getAsFile();
      if (file) loadImage(file);
    }
  }, [loadImage]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    setMode(val.length > 0 ? "text" : "empty");
    if (val.length > 0 && imageFile) clearImage();
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setMode(text.length > 0 ? "text" : "empty");
  };

  const clearAll = () => {
    clearImage();
    setText("");
    setMode("empty");
    setState("idle");
    setError(null);
    setExtractionResult(null);
    setDraft(null);
    setMobileTextMode(false);
  };

  const handleMobileBack = () => {
    clearImage();
    setText("");
    setMode("empty");
    setMobileTextMode(false);
  };

  const handleSubmit = async () => {
    if (mode === "image" && imageFile) await handleImageSubmit();
    else if (mode === "text" && text.trim()) await handleTextSubmit();
  };

  const handleImageSubmit = async () => {
    if (!imageFile) return;
    setSubmissionKind("image");
    setState("uploading");

    try {
      const res = await startUpload([imageFile]);
      if (!res || res.length === 0) throw new Error("Upload failed");

      setState("processing");
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: getUploadThingPublicUrl(res[0]),
          fileName: res[0].name,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to process image";
        try {
          const data = await response.json();
          if (data && typeof data.error === "string") {
            errorMessage = data.error;
          }
        } catch {
          // keep default
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      onExtracted(data);
    } catch (err) {
      onError(err);
    }
  };

  const handleTextSubmit = async () => {
    setSubmissionKind("text");
    setState("processing");

    try {
      const response = await fetch("/api/extract-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to process text");
      }
      const data = await response.json();
      onExtracted(data);
    } catch (err) {
      onError(err);
    }
  };

  const onExtracted = (data: { sourceImageId: string; extraction: ExtractionResult }) => {
    const totalFound =
      data.extraction.kanji.length +
      data.extraction.vocabulary.length +
      data.extraction.sentences.length;

    if (totalFound === 0) {
      setState("empty");
      return;
    }

    setDraft({ sourceImageId: data.sourceImageId, extraction: data.extraction });
    setState("confirming");
  };

  const onSaved = (data: SaveResponse) => {
    setExtractionResult({ extracted: data.extracted, items: data.items });
    setDraft(null);
    setState("success");

    const counts = data.extracted;
    const totalSaved = counts.kanji.total + counts.vocabulary.total + counts.sentences;
    const totalNew = counts.kanji.new + counts.vocabulary.new + counts.sentences;

    if (totalSaved > 0) {
      toast({
        title: totalNew > 0 ? "Saved to your library" : "Already in your library",
        description: totalNew > 0
          ? `${totalSaved} item${totalSaved === 1 ? "" : "s"} added (${totalNew} new)`
          : `${totalSaved} item${totalSaved === 1 ? "" : "s"} merged`,
      });
    }
  };

  const onError = (err: unknown) => {
    setState("error");
    setError(err instanceof Error ? err.message : "An error occurred");
    toast({
      title: "Error",
      description: "Failed to process your content. Please try again.",
      variant: "destructive",
    });
  };

  const onSaveError = (message: string) => {
    toast({
      title: "Couldn't save",
      description: message,
      variant: "destructive",
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && mode === "text") {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (state === "uploading" || state === "processing") {
    const progressPct =
      state === "uploading"
        ? Math.min(28, (1 / stages.length) * 100)
        : Math.min(
            92,
            ((captureStageIndex + 1) / stages.length) * 100,
          );
    const headline =
      stages[captureStageIndex]?.title ?? "Working on your capture";
    const subline =
      stages[captureStageIndex]?.subtitle ??
      "Kanji Katch is finishing up.";

    return (
      <Card className="jr-panel">
        <CardContent className="py-10 px-4 sm:px-8">
          <div className="max-w-md mx-auto">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-center mb-2">
              Kanji Katch
            </p>
            <h3 className="text-lg font-semibold text-center mb-1">
              {headline}
            </h3>
            <p className="text-sm text-muted-foreground text-center mb-6">
              {subline}
            </p>

            <div
              className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-8"
              role="progressbar"
              aria-valuenow={Math.round(progressPct)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <ol className="space-y-0">
              {stages.map((stage, i) => {
                const uploadComplete =
                  state === "processing" && submissionKind === "image";
                const done =
                  i < captureStageIndex ||
                  (uploadComplete && i === 0);
                const current = i === captureStageIndex;
                const pending = !done && !current;

                return (
                  <li
                    key={stage.title}
                    className={cn(
                      "flex gap-3 py-3 border-b border-border/60 last:border-0",
                      pending && "opacity-45",
                    )}
                  >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border bg-background">
                      {done ? (
                        <Check className="h-4 w-4 text-primary" aria-hidden />
                      ) : current ? (
                        <Loader2
                          className="h-4 w-4 animate-spin text-primary"
                          aria-hidden
                        />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/35" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p
                        className={cn(
                          "text-sm font-medium leading-tight",
                          current && "text-foreground",
                          pending && "text-muted-foreground",
                          done && "text-muted-foreground",
                        )}
                      >
                        {stage.title}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state === "confirming" && draft) {
    return (
      <ExtractionConfirmation
        sourceImageId={draft.sourceImageId}
        extraction={draft.extraction}
        onSaved={onSaved}
        onDiscard={clearAll}
        onError={onSaveError}
      />
    );
  }

  if (state === "empty") {
    return (
      <Card className="jr-panel">
        <CardContent className="py-16">
          <div className="text-center">
            <SearchX className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No Japanese content found</h3>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
              The AI couldn&apos;t detect any kanji, vocabulary, or sentences.
              Try a clearer photo, better lighting, or crop closer to your notes.
            </p>
            <Button className="mt-6" onClick={clearAll}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state === "success" && extractionResult) {
    const counts = extractionResult.extracted;
    const { items: extractedItems } = extractionResult;
    const totalNew = counts.kanji.new + counts.vocabulary.new + counts.sentences;

    const newKanji = extractedItems.kanji.filter(i => i.isNew);
    const existingKanji = extractedItems.kanji.filter(i => !i.isNew);
    const newVocab = extractedItems.vocabulary.filter(i => i.isNew);
    const existingVocab = extractedItems.vocabulary.filter(i => !i.isNew);

    const nothingFound =
      extractedItems.kanji.length === 0 &&
      extractedItems.vocabulary.length === 0 &&
      counts.sentences === 0;

    if (nothingFound) {
      return (
        <Card className="jr-panel">
          <CardContent className="py-16">
            <div className="text-center">
              <SearchX className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold">No Japanese content found</h3>
              <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                Kanji Katch didn&apos;t find any kanji, vocabulary, or sentences in this capture.
                Try a clearer photo, better lighting, or crop closer to your notes.
              </p>
              <Button className="mt-6" onClick={clearAll}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="jr-panel">
        <CardContent className="py-10">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold">
              {totalNew > 0 ? "Content extracted!" : "All items already in library"}
            </h3>
          </div>

          <div className="mt-5 space-y-4 max-w-sm mx-auto text-sm">
            {extractedItems.kanji.length > 0 && (
              <div>
                <div className="flex justify-between items-baseline mb-2 px-1">
                  <span className="font-medium text-muted-foreground">Kanji</span>
                  <span className="text-xs text-muted-foreground">
                    {counts.kanji.new > 0 && <span className="text-primary">{counts.kanji.new} new</span>}
                    {counts.kanji.new > 0 && counts.kanji.existing > 0 && ", "}
                    {counts.kanji.existing > 0 && `${counts.kanji.existing} seen`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {newKanji.map(k => (
                    <span key={k.text} className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-primary/10 text-primary font-medium text-base">
                      {k.text}
                    </span>
                  ))}
                  {existingKanji.map(k => (
                    <span key={k.text} className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-muted/60 text-muted-foreground font-medium text-base">
                      {k.text}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {extractedItems.vocabulary.length > 0 && (
              <div>
                <div className="flex justify-between items-baseline mb-2 px-1">
                  <span className="font-medium text-muted-foreground">Vocabulary</span>
                  <span className="text-xs text-muted-foreground">
                    {counts.vocabulary.new > 0 && <span className="text-primary">{counts.vocabulary.new} new</span>}
                    {counts.vocabulary.new > 0 && counts.vocabulary.existing > 0 && ", "}
                    {counts.vocabulary.existing > 0 && `${counts.vocabulary.existing} seen`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {newVocab.map(v => (
                    <span key={`${v.text}-${v.reading}`} className="inline-flex items-center px-2.5 py-1 rounded-md bg-primary/10 text-primary font-medium text-sm">
                      {v.text}
                    </span>
                  ))}
                  {existingVocab.map(v => (
                    <span key={`${v.text}-${v.reading}`} className="inline-flex items-center px-2.5 py-1 rounded-md bg-muted/60 text-muted-foreground font-medium text-sm">
                      {v.text}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {counts.sentences > 0 && (
              <div className="flex justify-between px-1 py-1.5 rounded-md bg-muted/40">
                <span className="text-muted-foreground">Sentences</span>
                <span className="font-medium text-primary">{counts.sentences} added</span>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3 justify-center">
            <Button variant="outline" onClick={clearAll}>
              Capture More
            </Button>
            <Button onClick={() => router.push("/review")}>
              Review
            </Button>
            <Button variant="outline" onClick={() => { router.push("/library"); router.refresh(); }}>
              View Library
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state === "error") {
    return (
      <Card className="jr-panel">
        <CardContent className="py-16">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-jr-red" />
            <h3 className="text-lg font-semibold">Something went wrong</h3>
            <p className="text-muted-foreground mt-2">{error}</p>
            <Button className="mt-4" onClick={clearAll}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* ── Mobile Layout ── */}
      <div className="md:hidden">
        {mode === "image" && imagePreview ? (
          <Card className="jr-panel">
            <CardContent className="pt-5 pb-5">
              <button
                type="button"
                onClick={handleMobileBack}
                className="flex items-center gap-1 text-sm text-muted-foreground mb-4 -ml-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Change
              </button>
              <div className="rounded-lg overflow-hidden bg-muted/30 border border-border">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full max-h-[280px] object-contain"
                />
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-3 mb-4 truncate">
                <ImageIcon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{imageFile?.name}</span>
              </p>
              <Button onClick={handleSubmit} className="w-full gap-2" size="lg">
                Extract Content
              </Button>
            </CardContent>
          </Card>
        ) : mobileTextMode ? (
          <Card className="jr-panel">
            <CardContent className="pt-5 pb-5">
              <button
                type="button"
                onClick={handleMobileBack}
                className="flex items-center gap-1 text-sm text-muted-foreground mb-3 -ml-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <textarea
                value={text}
                onChange={handleTextChange}
                onPaste={handlePaste}
                placeholder="Paste or type Japanese text..."
                className="w-full min-h-[180px] bg-muted/20 rounded-lg px-4 py-3 text-base resize-y placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 border border-border"
                autoFocus
              />
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-muted-foreground">
                  {text.length > 0 ? `${text.length.toLocaleString()} characters` : ""}
                </p>
                <Button
                  onClick={handleSubmit}
                  disabled={text.trim().length === 0}
                  className="gap-2"
                >
                  Extract Content
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="w-full flex items-center gap-4 p-4 bg-white border rounded-xl text-left transition-all active:scale-[0.98]"
              style={{ borderColor: "hsl(35 15% 86%)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
            >
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Camera className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-[15px]">Take Photo</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Snap your Japanese notes
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-4 p-4 bg-white border rounded-xl text-left transition-all active:scale-[0.98]"
              style={{ borderColor: "hsl(35 15% 86%)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
            >
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <ImageIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-[15px]">Choose Photo</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Pick from your photo library
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMobileTextMode(true)}
              className="w-full flex items-center gap-4 p-4 bg-white border rounded-xl text-left transition-all active:scale-[0.98]"
              style={{ borderColor: "hsl(35 15% 86%)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
            >
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Type className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-[15px]">Paste or Type</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Paste an image or enter text
                </p>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* ── Desktop Layout ── */}
      <div className="hidden md:block">
        <Card className="jr-panel">
          <CardContent className="pt-6">
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onPaste={handlePaste}
              tabIndex={0}
              className={`
                relative rounded-lg border-2 border-dashed transition-colors outline-none
                ${isDragOver
                  ? "border-primary bg-primary/5"
                  : mode === "image"
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:border-primary/30"
                }
              `}
            >
              {mode === "image" && imagePreview ? (
                <div className="p-4">
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-[200px] rounded-md object-contain"
                    />
                    <button
                      type="button"
                      onClick={clearImage}
                      className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-1 shadow-sm hover:bg-muted transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3 flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" />
                    {imageFile?.name}
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={isDragOver ? "" : "Paste your Japanese notes here..."}
                    className="w-full min-h-[220px] bg-transparent px-4 py-4 text-base resize-y placeholder:text-muted-foreground/60 focus:outline-none"
                  />

                  {mode === "empty" && !isDragOver && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <Upload className="h-8 w-8 text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground/60 pointer-events-auto">
                        Paste or drop an image,{" "}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-primary underline underline-offset-2 cursor-pointer"
                        >
                          browse files
                        </button>
                        , or type text directly
                      </p>
                      <p className="text-xs text-muted-foreground/40 mt-1">
                        Screenshots, photos (JPEG, PNG, WebP up to 4MB), or any Japanese text
                      </p>
                    </div>
                  )}

                  {isDragOver && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-primary/5 rounded-lg">
                      <Upload className="h-10 w-10 text-primary mb-3" />
                      <p className="text-sm font-medium text-primary">
                        Drop your image here
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                {mode === "text"
                  ? `${text.length.toLocaleString()} characters · ⌘+Enter to submit`
                  : mode === "image"
                    ? "Image ready"
                    : ""}
              </p>
              <Button
                onClick={handleSubmit}
                disabled={mode === "empty"}
                className="gap-2"
              >
                Extract Content
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
