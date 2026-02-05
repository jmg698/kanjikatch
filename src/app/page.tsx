import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, BookOpen, Brain } from "lucide-react";

export default async function HomePage() {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/95238550-d0b8-43ea-8c9b-d8d447bc1b58',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:9',message:'HomePage render start',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'C,E'})}).catch(()=>{});
  // #endregion
  
  try {
    const { userId } = await auth();
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/95238550-d0b8-43ea-8c9b-d8d447bc1b58',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:15',message:'Auth result',data:{userId:userId||'null'},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'C,E'})}).catch(()=>{});
    // #endregion

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 to-background">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-primary">漢字</span>
            <span className="text-xl font-semibold">KanjiKatch</span>
          </div>
          <div className="flex items-center gap-4">
            {userId ? (
              <Button asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/sign-in">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link href="/sign-up">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-right max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            Capture Your Japanese
            <span className="text-primary"> Learning Journey</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Photograph your handwritten notes, textbooks, or any Japanese learning material. 
            AI extracts kanji, vocabulary, and sentences to build your personal knowledge base 
            with smart review exercises.
          </p>
          <div className="mt-10 flex items-center justify-end gap-4">
            <Button size="lg" asChild>
              <Link href={userId ? "/dashboard" : "/sign-up"}>
                Start Learning
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#features">Learn More</Link>
            </Button>
          </div>
        </div>

        {/* Features */}
        <div id="features" className="mt-24 grid gap-8 md:grid-cols-3">
          <Card className="jr-panel">
            <CardHeader>
              <Camera className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Snap & Extract</CardTitle>
              <CardDescription>
                Photograph notes or printed materials. AI automatically extracts Japanese content.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="jr-panel">
            <CardHeader>
              <BookOpen className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Knowledge Base</CardTitle>
              <CardDescription>
                Build your personal collection of kanji, vocabulary, and sentences.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="jr-panel">
            <CardHeader>
              <Brain className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Smart Review</CardTitle>
              <CardDescription>
                Spaced repetition algorithms ensure you remember what you learn.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-16 border-t">
        <p className="text-center text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} KanjiKatch. Built for Japanese learners.
        </p>
      </footer>
    </div>
  );
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/95238550-d0b8-43ea-8c9b-d8d447bc1b58',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:115',message:'HomePage error',data:{error:error instanceof Error?error.message:String(error),stack:error instanceof Error?error.stack:''},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'C,E'})}).catch(()=>{});
    // #endregion
    throw error;
  }
}
