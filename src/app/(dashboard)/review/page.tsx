import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { GraduationCap } from "lucide-react";

export default function ReviewPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Review</h1>
        <p className="text-muted-foreground mt-1">
          Practice with spaced repetition to remember what you learn.
        </p>
      </div>

      <Card className="jr-panel">
        <CardContent className="py-12">
          <div className="text-center">
            <GraduationCap className="h-16 w-16 mx-auto mb-4 text-primary opacity-50" />
            <h3 className="text-xl font-semibold">No items due for review</h3>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              Items will appear here as they become due for review. 
              Start by capturing some Japanese content!
            </p>
            <Button asChild className="mt-6">
              <Link href="/capture">Capture Content</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
