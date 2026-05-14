import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { db, sourceImages, users } from "@/db";
import { textInputSchema } from "@/lib/validations";
import { extractFromText } from "@/lib/ai";
import { checkPlanLimit, commitExtraction } from "@/lib/plan-limits";
import { assertCostProtection, getClientIp, hashIp } from "@/lib/cost-protection";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ipHash = hashIp(getClientIp(req));

    const guard = await assertCostProtection({ userId, ipHash, endpoint: "extract_text" });
    if (!guard.allowed) {
      return NextResponse.json(
        { error: guard.message, code: guard.reason },
        { status: guard.status, headers: { "Retry-After": String(guard.retryAfterSec) } },
      );
    }

    const planDecision = await checkPlanLimit(userId, "extract");
    if (!planDecision.allowed) {
      return NextResponse.json(
        {
          error: planDecision.reason ?? "Extraction limit reached.",
          remaining: 0,
          limit: planDecision.limit,
          tier: planDecision.tier.tier,
          upgradeAvailable: planDecision.tier.isFree,
        },
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
      const extraction = await extractFromText(text, {
        userId,
        ipHash,
        endpoint: "extract_text",
      });

      await db
        .update(sourceImages)
        .set({ extractionRaw: extraction })
        .where(eq(sourceImages.id, source.id));

      await commitExtraction(userId);

      return NextResponse.json({
        success: true,
        sourceImageId: source.id,
        extraction,
        remaining: Math.max(0, planDecision.remaining - 1),
        limit: planDecision.limit,
        tier: planDecision.tier.tier,
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
