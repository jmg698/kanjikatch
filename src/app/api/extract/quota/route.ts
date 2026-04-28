import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkExtractionRateLimit, WEEKLY_EXTRACTION_LIMIT } from "@/lib/rate-limit";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { remaining } = await checkExtractionRateLimit(userId);
  return NextResponse.json({ remaining, limit: WEEKLY_EXTRACTION_LIMIT });
}
