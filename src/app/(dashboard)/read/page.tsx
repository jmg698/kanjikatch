import { Card, CardContent } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function ReadPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Read</h1>
        <p className="text-muted-foreground mt-1">
          Practice reading with articles matched to your level.
        </p>
      </div>

      <Card className="jr-panel">
        <CardContent className="py-12">
          <div className="text-center">
            <BookOpen className="h-16 w-16 mx-auto mb-4 text-primary opacity-40" />
            <h3 className="text-xl font-semibold">Reading Practice — Coming Soon</h3>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              We&apos;ll match real Japanese articles and AI-generated passages to your level.
              Keep reviewing to build your knowledge base — the more you know,
              the better we can match content to you.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              In Development
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
