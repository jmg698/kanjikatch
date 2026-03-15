import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { db, generatedSentences } from "@/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const rateSchema = z.object({
  sentenceId: z.string().uuid(),
  rating: z.enum(["too_easy", "just_right", "too_hard"]),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = rateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { sentenceId, rating } = parsed.data;

    const [updated] = await db
      .update(generatedSentences)
      .set({
        difficultyRating: rating,
        ratedAt: new Date(),
      })
      .where(
        and(
          eq(generatedSentences.id, sentenceId),
          eq(generatedSentences.userId, userId),
        ),
      )
      .returning({ id: generatedSentences.id, difficultyRating: generatedSentences.difficultyRating });

    if (!updated) {
      return NextResponse.json({ error: "Sentence not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, sentenceId: updated.id, rating: updated.difficultyRating });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Sentence rating error:", error);
    return NextResponse.json({ error: "Failed to rate sentence" }, { status: 500 });
  }
}
