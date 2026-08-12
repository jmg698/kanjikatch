"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GuideMarkdown } from "./guide-markdown";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Printer, Trash2, Loader2 } from "lucide-react";

interface GuideViewProps {
  guide: {
    id: string;
    title: string;
    contentMd: string;
    createdAt: string;
  };
  sourceNames: string[];
}

export function GuideView({ guide, sourceNames }: GuideViewProps) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleDelete = async () => {
    if (deleting) return;
    if (!window.confirm("Delete this study guide? Your library items are not affected.")) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/guides/${guide.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete the guide");
      }
      router.push("/guides");
      router.refresh();
    } catch (err) {
      setDeleting(false);
      toast({
        title: "Couldn't delete the guide",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const createdDate = new Date(guide.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          href="/guides"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          All guides
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Delete guide"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <Card className="jr-panel print:border-0 print:shadow-none">
        <CardContent className="py-8 px-5 sm:px-8">
          <p className="text-xs text-muted-foreground mb-4 print:mb-2">
            {createdDate}
            {sourceNames.length > 0 && ` · built from ${sourceNames.join(", ")}`}
          </p>
          <GuideMarkdown content={guide.contentMd} />
        </CardContent>
      </Card>
    </div>
  );
}
