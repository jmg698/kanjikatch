import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { db, sourceImages, users } from "@/db";
import { textInputSchema } from "@/lib/validations";
import { extractFromText } from "@/lib/ai";
import { checkExtractionRateLimit } from "@/lib/rate-limit";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed } = await checkExtractionRateLimit(userId);
    if (!allowed) {
      return NextResponse.json(
        { error: "Weekly extraction limit reached (200 per week). Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = textInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { text } = parsed.data;

    const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (existingUser.length === 0) {
      await db.insert(users).values({
        id: userId,
        email: "unknown@example.com",
      });
    }

    const [source] = await db
      .insert(sourceImages)
      .values({
        userId,
        sourceText: text,
        processed: false,
      })
      .returning();

    try {
      const extraction = await extractFromText(text);

      await db
        .update(sourceImages)
        .set({ extractionRaw: extraction })
        .where(eq(sourceImages.id, source.id));

      return NextResponse.json({
        success: true,
        sourceImageId: source.id,
        extraction,
      });
    } catch (extractionError) {
      const errorMessage =
        extractionError instanceof Error
          ? extractionError.message
          : "Unknown extraction error";

      await db
        .update(sourceImages)
        .set({
          errorMessage,
          processed: true,
        })
        .where(eq(sourceImages.id, source.id));

      throw extractionError;
    }
  } catch (error) {
    Sentry.captureException(error);
    console.error("Text extraction error:", error);
    return NextResponse.json({ error: "Failed to process text" }, { status: 500 });
  }
}
