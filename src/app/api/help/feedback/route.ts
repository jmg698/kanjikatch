import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { and, count, eq, gte } from "drizzle-orm";
import { db, helpArticleFeedback, users } from "@/db";
import { helpFeedbackSchema } from "@/lib/validations";
import { getArticleMeta } from "@/lib/help-center";
import { getClientIp, hashIp } from "@/lib/cost-protection";

// Public: anyone reading the help center can vote. Signed-in votes are tied
// to the user; anonymous ones are throttled by hashed IP.
const MAX_VOTES_PER_IP_PER_HOUR = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = helpFeedbackSchema.safeParse(body);
    if (!parsed.success || !getArticleMeta(parsed.data.articleSlug)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const ipHash = hashIp(getClientIp(req));
    if (ipHash) {
      const [{ value: recent }] = await db
        .select({ value: count() })
        .from(helpArticleFeedback)
        .where(
          and(
            eq(helpArticleFeedback.ipHash, ipHash),
            gte(helpArticleFeedback.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
          ),
        );
      if (recent >= MAX_VOTES_PER_IP_PER_HOUR) {
        return NextResponse.json(
          { error: "You're going a bit fast. Please wait a moment and try again." },
          { status: 429 },
        );
      }
    }

    // Only attach the user if their row exists — a vote should never fail
    // because the Clerk webhook hasn't synced a brand-new account yet.
    const { userId } = await auth();
    let knownUserId: string | null = null;
    if (userId) {
      const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
      knownUserId = row?.id ?? null;
    }

    const { articleSlug, helpful, comment } = parsed.data;
    await db.insert(helpArticleFeedback).values({
      articleSlug,
      helpful,
      comment: comment ? comment : null,
      userId: knownUserId,
      ipHash,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Help feedback error:", error);
    return NextResponse.json({ error: "Failed to send feedback" }, { status: 500 });
  }
}
