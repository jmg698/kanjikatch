"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

export function ExportButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to build export");
      }
      const blob = await res.blob();
      const filename =
        parseFilenameFromContentDisposition(res.headers.get("content-disposition")) ??
        `kanjikatch-export-${new Date().toISOString().slice(0, 10)}.json`;
      triggerDownload(blob, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build export");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button variant="outline" onClick={handleExport} disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        Export my data
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function parseFilenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/filename="?([^";]+)"?/);
  return match?.[1] ?? null;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
