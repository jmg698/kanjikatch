import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { db, userReports, users } from "@/db";
import { feedbackSchema } from "@/lib/validations";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { category, sourceImageId, note, errorMessage } = parsed.data;
    const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

    // Brand-new accounts may submit feedback before the Clerk webhook has
    // synced their user row. Mirror the upsert pattern used by the extract
    // routes so the FK insert succeeds.
    const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (existingUser.length === 0) {
      await db.insert(users).values({ id: userId, email: "unknown@example.com" });
    }

    const [report] = await db
      .insert(userReports)
      .values({
        userId,
        sourceImageId: sourceImageId ?? null,
        category,
        note: note ?? null,
        userAgent,
        errorMessageSnapshot: errorMessage ?? null,
      })
      .returning({ id: userReports.id });

    return NextResponse.json({ success: true, reportId: report.id });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Feedback error:", error);
    return NextResponse.json({ error: "Failed to send report" }, { status: 500 });
  }
}
