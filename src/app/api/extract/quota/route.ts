import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { readPlanQuota } from "@/lib/plan-limits";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { remaining, limit, tier } = await readPlanQuota(userId);
  return NextResponse.json({
    remaining,
    limit,
    tier: tier.tier,
    isPro: tier.isPro,
  });
}
