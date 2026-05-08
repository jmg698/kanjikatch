import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { listUserSourcesWithProgress } from "@/lib/sources-progress";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sources = await listUserSourcesWithProgress(userId);
    return NextResponse.json({ sources });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Sources list error:", error);
    return NextResponse.json({ error: "Failed to fetch sources" }, { status: 500 });
  }
}
