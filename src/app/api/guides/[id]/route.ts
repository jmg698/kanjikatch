import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { db, studyGuides } from "@/db";
import { and, eq } from "drizzle-orm";

const idSchema = z.string().uuid();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: "Invalid guide id" }, { status: 400 });
    }

    const [guide] = await db
      .select()
      .from(studyGuides)
      .where(and(eq(studyGuides.id, parsedId.data), eq(studyGuides.userId, userId)))
      .limit(1);

    if (!guide) {
      return NextResponse.json({ error: "Guide not found" }, { status: 404 });
    }

    return NextResponse.json({ guide });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Guide fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch study guide" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: "Invalid guide id" }, { status: 400 });
    }

    const deleted = await db
      .delete(studyGuides)
      .where(and(eq(studyGuides.id, parsedId.data), eq(studyGuides.userId, userId)))
      .returning({ id: studyGuides.id });

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Guide not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Guide delete error:", error);
    return NextResponse.json({ error: "Failed to delete study guide" }, { status: 500 });
  }
}
