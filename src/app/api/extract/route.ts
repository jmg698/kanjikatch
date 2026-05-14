import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { db, sourceImages, users } from "@/db";
import { uploadSchema } from "@/lib/validations";
import { extractFromImage } from "@/lib/ai";
import { checkPlanLimit, commitExtraction } from "@/lib/plan-limits";
import { assertCostProtection, getClientIp, hashIp } from "@/lib/cost-protection";
import { eq } from "drizzle-orm";
import { agentDebugLog } from "@/lib/debug-ingest";

function blockedResponse(reason: string, message: string, status: 429 | 503, retryAfterSec: number) {
  return NextResponse.json(
    { error: message, code: reason },
    { status, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ipHash = hashIp(getClientIp(req));

    // Cost protection (Package 0): circuit breaker, per-user token cap, per-IP throttle.
    const guard = await assertCostProtection({ userId, ipHash, endpoint: "extract" });
    if (!guard.allowed) {
      return blockedResponse(guard.reason, guard.message, guard.status, guard.retryAfterSec);
    }

    // Plan-aware extraction gate (Package 2). Decides allowed/remaining/limit
    // based on the user's tier and the per-period counters; covers both the
    // free-tier wall and the Pro fair-use ceiling.
    const planDecision = await checkPlanLimit(userId, "extract");
    // #region agent log
    agentDebugLog("H0", "api/extract/route.ts:POST", "after_auth_rate", {
      allowed: planDecision.allowed,
      remaining: planDecision.remaining,
      tier: planDecision.tier.tier,
    });
    // #endregion
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
    const parsed = uploadSchema.safeParse(body);

    if (!parsed.success) {
      // #region agent log
      agentDebugLog("H1", "api/extract/route.ts:POST", "upload_schema_failed", {
        issueCount: parsed.error.issues.length,
        codes: parsed.error.issues.slice(0, 5).map((i) => i.code),
      });
      // #endregion
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { imageUrl, fileName } = parsed.data;
    // #region agent log
    let imageHost = "parse-failed";
    try {
      imageHost = new URL(imageUrl).hostname;
    } catch {
      imageHost = "invalid-url";
    }
    agentDebugLog("H1", "api/extract/route.ts:POST", "upload_schema_ok", {
      imageHost,
      fileNameLen: fileName?.length ?? 0,
    });
    // #endregion

    // Ensure user exists in our database
    const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (existingUser.length === 0) {
      await db.insert(users).values({
        id: userId,
        email: "unknown@example.com", // Will be updated by webhook
      });
    }

    // Create source image record. Stays processed=false until the user
    // confirms and the /api/extract/save endpoint commits items.
    const [sourceImage] = await db
      .insert(sourceImages)
      .values({
        userId,
        imageUrl,
        processed: false,
      })
      .returning();

    // #region agent log
    agentDebugLog("H5", "api/extract/route.ts:POST", "source_image_inserted", {
      sourceImageId: sourceImage.id,
    });
    // #endregion

    try {
      // #region agent log
      agentDebugLog("H3", "api/extract/route.ts:POST", "before_extractFromImage", {});
      // #endregion
      const extraction = await extractFromImage(imageUrl, {
        userId,
        ipHash,
        endpoint: "extract",
      });
      // #region agent log
      agentDebugLog("H4", "api/extract/route.ts:POST", "extractFromImage_ok", {
        kanji: extraction.kanji.length,
        vocabulary: extraction.vocabulary.length,
        sentences: extraction.sentences.length,
      });
      // #endregion

      await db
        .update(sourceImages)
        .set({ extractionRaw: extraction })
        .where(eq(sourceImages.id, sourceImage.id));

      // Spend the extraction credit only after the LLM call succeeded — if
      // the model fails or we throw mid-flight, the user keeps the credit.
      await commitExtraction(userId);

      return NextResponse.json({
        success: true,
        sourceImageId: sourceImage.id,
        extraction,
        remaining: Math.max(0, planDecision.remaining - 1),
        limit: planDecision.limit,
        tier: planDecision.tier.tier,
      });
    } catch (extractionError) {
      // Store error message on the source image and mark it processed so it
      // does not linger as a pending draft.
      const errorMessage =
        extractionError instanceof Error
          ? extractionError.message
          : "Unknown extraction error";

      // #region agent log
      agentDebugLog("H3", "api/extract/route.ts:POST", "inner_extract_catch", {
        msgPrefix: errorMessage.slice(0, 280),
        name: extractionError instanceof Error ? extractionError.name : "non-Error",
      });
      // #endregion

      await db
        .update(sourceImages)
        .set({
          errorMessage,
          processed: true,
        })
        .where(eq(sourceImages.id, sourceImage.id));

      throw extractionError;
    }
  } catch (error) {
    Sentry.captureException(error);
    console.error("Extraction error:", error);
    const rawMessage = error instanceof Error ? error.message : String(error);
    // #region agent log
    agentDebugLog("H5", "api/extract/route.ts:POST", "outer_catch", {
      msgPrefix: rawMessage.slice(0, 280),
      name: error instanceof Error ? error.name : "non-Error",
    });
    // #endregion
    const isOverloaded =
      typeof rawMessage === "string" &&
      (rawMessage.includes("overloaded_error") || rawMessage.includes("Overloaded") || rawMessage.startsWith("529 "));

    const userMessage = isOverloaded
      ? "Our AI is temporarily overloaded. Please try again in a minute."
      : "Failed to process image";

    return NextResponse.json({ error: userMessage }, { status: isOverloaded ? 503 : 500 });
  }
}
