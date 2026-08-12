import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { db, studyGuides } from "@/db";
import { guideGenerateSchema } from "@/lib/validations";
import { generateStudyGuide } from "@/lib/ai";
import { gatherGuideMaterial } from "@/lib/study-guides";
import { assertCostProtection, getClientIp, hashIp } from "@/lib/cost-protection";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ipHash = hashIp(getClientIp(req));

    const guard = await assertCostProtection({ userId, ipHash, endpoint: "guide_generate" });
    if (!guard.allowed) {
      return NextResponse.json(
        { error: guard.message, code: guard.reason },
        { status: guard.status, headers: { "Retry-After": String(guard.retryAfterSec) } },
      );
    }

    const body = await req.json();
    const parsed = guideGenerateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const material = await gatherGuideMaterial(userId, parsed.data.sourceImageIds);
    if (!material) {
      return NextResponse.json(
        { error: "One or more captures weren't found or haven't finished processing." },
        { status: 404 },
      );
    }
    if (material.itemCount === 0) {
      return NextResponse.json(
        { error: "Nothing was saved from these captures yet — save some items first." },
        { status: 422 },
      );
    }

    const { title, markdown, model } = await generateStudyGuide(material.input, {
      userId,
      ipHash,
      endpoint: "guide_generate",
    });

    const [guide] = await db
      .insert(studyGuides)
      .values({
        userId,
        title,
        contentMd: markdown,
        sourceImageIds: parsed.data.sourceImageIds,
        model,
      })
      .returning({ id: studyGuides.id, title: studyGuides.title, createdAt: studyGuides.createdAt });

    return NextResponse.json({ success: true, guide });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Guide generation error:", error);
    const rawMessage = error instanceof Error ? error.message : String(error);
    const isOverloaded =
      rawMessage.includes("overloaded_error") ||
      rawMessage.includes("Overloaded") ||
      rawMessage.startsWith("529 ");

    return NextResponse.json(
      {
        error: isOverloaded
          ? "Our AI is temporarily overloaded. Please try again in a minute."
          : "Failed to generate the study guide. Please try again.",
      },
      { status: isOverloaded ? 503 : 500 },
    );
  }
}
