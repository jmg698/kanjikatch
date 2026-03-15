import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { db, vocabulary } from "@/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const quickAddSchema = z.object({
  word: z.string().min(1).max(100),
  reading: z.string().min(1).max(100),
  meanings: z.array(z.string()).min(1),
  partOfSpeech: z.string().max(50).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = quickAddSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
    }

    const { word, reading, meanings, partOfSpeech } = parsed.data;

    // Check for duplicates
    const existing = await db
      .select()
      .from(vocabulary)
      .where(and(eq(vocabulary.userId, userId), eq(vocabulary.word, word), eq(vocabulary.reading, reading)));

    if (existing.length > 0) {
      return NextResponse.json({ error: "Already in your library", existing: existing[0] }, { status: 409 });
    }

    const [inserted] = await db
      .insert(vocabulary)
      .values({
        userId,
        word,
        reading,
        meanings,
        partOfSpeech: partOfSpeech ?? null,
      })
      .returning();

    return NextResponse.json({ vocabulary: inserted }, { status: 201 });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Quick add error:", error);
    return NextResponse.json({ error: "Failed to add vocabulary" }, { status: 500 });
  }
}
