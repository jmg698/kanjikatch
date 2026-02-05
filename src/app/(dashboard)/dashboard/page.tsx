import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, BookOpen, GraduationCap, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back!</h1>
        <p className="text-muted-foreground mt-1">
          Continue your Japanese learning journey.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="jr-panel hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <Camera className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Capture New</CardTitle>
            <CardDescription>
              Upload a photo of your notes or learning materials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/capture">Start Capture</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="jr-panel hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <GraduationCap className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Review Session</CardTitle>
            <CardDescription>
              Practice with spaced repetition flashcards
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/review">Start Review</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="jr-panel hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <BookOpen className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Your Library</CardTitle>
            <CardDescription>
              Browse your kanji, vocabulary, and sentences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/library">View Library</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Your Progress</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="jr-panel">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-wider">Total Kanji</CardDescription>
              <CardTitle className="text-3xl font-mono font-bold">0</CardTitle>
            </CardHeader>
          </Card>
          <Card className="jr-panel">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-wider">Vocabulary</CardDescription>
              <CardTitle className="text-3xl font-mono font-bold">0</CardTitle>
            </CardHeader>
          </Card>
          <Card className="jr-panel">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-wider">Sentences</CardDescription>
              <CardTitle className="text-3xl font-mono font-bold">0</CardTitle>
            </CardHeader>
          </Card>
          <Card className="jr-panel">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-wider">Due for Review</CardDescription>
              <CardTitle className="text-3xl font-mono font-bold">0</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <Card className="jr-panel">
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No activity yet. Start by capturing your first image!</p>
              <Button asChild className="mt-4">
                <Link href="/capture">Capture Now</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
