import { SentenceLibrary } from "@/components/wild/sentence-library";
import { getCurrentUserId } from "@/lib/auth";
import { db, generatedSentences } from "@/db";
import { eq } from "drizzle-orm";

export default async function ReadPage() {
  const userId = await getCurrentUserId();

  const count = await db
    .select()
    .from(generatedSentences)
    .where(eq(generatedSentences.userId, userId));

  const hasAnySentences = count.length > 0;

  return <SentenceLibrary hasAnySentences={hasAnySentences} />;
}
