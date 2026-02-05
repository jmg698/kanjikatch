import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db, kanji, vocabulary, sentences } from "@/db";
import { getCurrentUserId } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

async function getLibraryData(userId: string) {
  const [kanjiList, vocabList, sentenceList] = await Promise.all([
    db.select().from(kanji).where(eq(kanji.userId, userId)).orderBy(desc(kanji.lastSeenAt)),
    db.select().from(vocabulary).where(eq(vocabulary.userId, userId)).orderBy(desc(vocabulary.lastSeenAt)),
    db.select().from(sentences).where(eq(sentences.userId, userId)).orderBy(desc(sentences.createdAt)),
  ]);

  return { kanjiList, vocabList, sentenceList };
}

export default async function LibraryPage() {
  const userId = await getCurrentUserId();
  const { kanjiList, vocabList, sentenceList } = await getLibraryData(userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Library</h1>
        <p className="text-muted-foreground mt-1">
          Browse your collected kanji, vocabulary, and sentences.
        </p>
      </div>

      <Tabs defaultValue="kanji" className="space-y-4">
        <TabsList>
          <TabsTrigger value="kanji">
            Kanji ({kanjiList.length})
          </TabsTrigger>
          <TabsTrigger value="vocabulary">
            Vocabulary ({vocabList.length})
          </TabsTrigger>
          <TabsTrigger value="sentences">
            Sentences ({sentenceList.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanji" className="space-y-4">
          {kanjiList.length === 0 ? (
            <Card className="jr-panel">
              <CardContent className="py-8 text-center text-muted-foreground">
                No kanji yet. Capture an image to start building your collection!
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {kanjiList.map((k) => (
                <Card key={k.id} className="jr-panel">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-bold">{k.character}</span>
                        {k.timesSeen > 1 && (
                          <span className="text-xs text-muted-foreground">
                            ×{k.timesSeen}
                          </span>
                        )}
                      </div>
                      {k.jlptLevel && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-mono font-medium">
                          N{k.jlptLevel}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="font-medium">{k.meanings.join(", ")}</p>
                    {k.readingsOn.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">On:</span> {k.readingsOn.join(", ")}
                      </p>
                    )}
                    {k.readingsKun.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Kun:</span> {k.readingsKun.join(", ")}
                      </p>
                    )}
                    {k.strokeCount && (
                      <p className="text-xs text-muted-foreground">
                        {k.strokeCount} strokes
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="vocabulary" className="space-y-4">
          {vocabList.length === 0 ? (
            <Card className="jr-panel">
              <CardContent className="py-8 text-center text-muted-foreground">
                No vocabulary yet. Capture an image to start building your collection!
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {vocabList.map((v) => (
                <Card key={v.id} className="jr-panel">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <CardTitle className="text-2xl">{v.word}</CardTitle>
                          {v.timesSeen > 1 && (
                            <span className="text-xs text-muted-foreground">
                              ×{v.timesSeen}
                            </span>
                          )}
                        </div>
                        <CardDescription>{v.reading}</CardDescription>
                      </div>
                      {v.jlptLevel && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-mono font-medium">
                          N{v.jlptLevel}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="font-medium">{v.meanings.join(", ")}</p>
                    {v.partOfSpeech && (
                      <p className="text-xs text-muted-foreground">{v.partOfSpeech}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sentences" className="space-y-4">
          {sentenceList.length === 0 ? (
            <Card className="jr-panel">
              <CardContent className="py-8 text-center text-muted-foreground">
                No sentences yet. Capture an image to start building your collection!
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sentenceList.map((s) => (
                <Card key={s.id} className="jr-panel">
                  <CardContent className="py-4 space-y-2">
                    <p className="text-xl">{s.japanese}</p>
                    {s.english && (
                      <p className="font-medium">{s.english}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Source: {s.source}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
