import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { db, sourceImages } from "@/db";
import { and, eq } from "drizzle-orm";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Invalid source id" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(sourceImages)
      .set({ name: parsed.data.name })
      .where(and(eq(sourceImages.id, id), eq(sourceImages.userId, userId)))
      .returning({ id: sourceImages.id, name: sourceImages.name });

    if (!updated) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    return NextResponse.json({ source: updated });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Source rename error:", error);
    return NextResponse.json({ error: "Failed to update source" }, { status: 500 });
  }
}
