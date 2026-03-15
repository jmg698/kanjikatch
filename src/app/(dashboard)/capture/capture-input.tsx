"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUploadThing } from "@/lib/uploadthing";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2, CheckCircle, AlertCircle, Upload, X,
  Image as ImageIcon, Camera, Type, ChevronLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type InputMode = "empty" | "text" | "image";
type ProcessState = "idle" | "uploading" | "processing" | "success" | "error";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function CaptureInput() {
  const [mode, setMode] = useState<InputMode>("empty");
  const [state, setState] = useState<ProcessState>("idle");
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileTextMode, setMobileTextMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const router = useRouter();
  const { toast } = useToast();

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
    setState("uploading");

    try {
      const res = await startUpload([imageFile]);
      if (!res || res.length === 0) throw new Error("Upload failed");

      setState("processing");
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: res[0].url,
          fileName: res[0].name,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to process image";
        try {
          const data = await response.json();
          if (data && typeof data.error === "string") {
            errorMessage = data.error;
          } else if (data && typeof data.details === "string") {
            errorMessage = data.details;
          }
        } catch {
          // keep default
        }
        throw new Error(errorMessage);
      }
      onSuccess();
    } catch (err) {
      onError(err);
    }
  };

  const handleTextSubmit = async () => {
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
      onSuccess();
    } catch (err) {
      onError(err);
    }
  };

  const onSuccess = () => {
    setState("success");
    toast({
      title: "Success!",
      description: "Content has been extracted and added to your library.",
    });
    setTimeout(() => {
      router.push("/library");
      router.refresh();
    }, 1500);
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && mode === "text") {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (state === "uploading" || state === "processing") {
    return (
      <Card className="jr-panel">
        <CardContent className="py-16">
          <div className="text-center">
            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
            <h3 className="text-lg font-semibold">
              {state === "uploading" ? "Uploading image..." : "Extracting content..."}
            </h3>
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
        <CardContent className="py-16">
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
              tabIndex={mode === "image" ? 0 : undefined}
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
                    className="relative z-10 w-full min-h-[220px] bg-transparent px-4 py-4 text-base resize-y placeholder:text-muted-foreground/60 focus:outline-none"
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
