"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadDropzone, getUploadThingPublicUrl } from "@/lib/uploadthing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type UploadState = "idle" | "uploading" | "processing" | "success" | "error";

export function CaptureUploader() {
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const handleUploadComplete = async (res: { url: string; ufsUrl?: string | null; name: string }[]) => {
    if (!res || res.length === 0) return;

    setState("processing");
    const file = res[0];

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: getUploadThingPublicUrl(file),
          fileName: file.name,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to process image");
      }

      setState("success");
      toast({
        title: "Success!",
        description: "Your image has been processed and content extracted.",
      });
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "An error occurred");
      toast({
        title: "Error",
        description: "Failed to process your image. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (state === "processing") {
    return (
      <Card className="jr-panel">
        <CardContent className="py-12">
          <div className="text-center">
            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
            <h3 className="text-lg font-semibold">Processing your image...</h3>
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
              Your image has been processed and content extracted.
            </p>
            <div className="mt-6 flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setState("idle")}>
                Capture More
              </Button>
              <Button variant="outline" onClick={() => router.push("/review")}>
                Review
              </Button>
              <Button onClick={() => { router.push("/library"); router.refresh(); }}>
                View Library
              </Button>
            </div>
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
        <CardTitle>Upload Image</CardTitle>
        <CardDescription>
          Supported formats: JPEG, PNG, WebP (max 4MB)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <UploadDropzone
          endpoint="imageUploader"
          onClientUploadComplete={handleUploadComplete}
          onUploadError={(error: Error) => {
            setState("error");
            setError(error.message);
          }}
          onUploadBegin={() => {
            setState("uploading");
          }}
          appearance={{
            container: "border-2 border-dashed border-border rounded-lg p-8 hover:border-primary/50 transition-colors",
            uploadIcon: "text-primary",
            label: "text-foreground",
            allowedContent: "text-muted-foreground text-sm",
            button: "bg-primary hover:bg-jr-green-light text-white font-medium py-2 px-4 rounded-md transition-colors ut-uploading:bg-primary/70",
          }}
        />
      </CardContent>
    </Card>
  );
}
