import { db, sourceImages } from "@/db";
import { eq, and, gte, sql } from "drizzle-orm";

export const WEEKLY_EXTRACTION_LIMIT = 200;

export async function checkExtractionRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sourceImages)
    .where(
      and(
        eq(sourceImages.userId, userId),
        gte(sourceImages.uploadedAt, oneWeekAgo)
      )
    );

  const count = result?.count ?? 0;
  const remaining = Math.max(0, WEEKLY_EXTRACTION_LIMIT - count);

  return { allowed: count < WEEKLY_EXTRACTION_LIMIT, remaining };
}
