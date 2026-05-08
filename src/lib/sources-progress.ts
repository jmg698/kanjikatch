import { db, sourceImages, kanji, reviewTracks } from "@/db";
import { eq, and, desc, sql } from "drizzle-orm";
import type { ConfidenceLevel } from "./srs";
import { getDefaultSourceName, getSourceProgress, type SourceProgress } from "./mastery";

export interface SourceWithProgress {
  id: string;
  name: string;
  uploadedAt: string;
  hasImage: boolean;
  progress: SourceProgress;
}

/**
 * List a user's processed sources with per-source kanji progress. Used by
 * both the dashboard server component and the /api/sources route.
 */
export async function listUserSourcesWithProgress(
  userId: string,
): Promise<SourceWithProgress[]> {
  const sources = await db
    .select({
      id: sourceImages.id,
      name: sourceImages.name,
      uploadedAt: sourceImages.uploadedAt,
      imageUrl: sourceImages.imageUrl,
    })
    .from(sourceImages)
    .where(and(eq(sourceImages.userId, userId), eq(sourceImages.processed, true)))
    .orderBy(desc(sourceImages.uploadedAt));

  if (sources.length === 0) return [];

  const kanjiRows = await db
    .select({
      id: kanji.id,
      sourceImageIds: kanji.sourceImageIds,
      confidence: sql<string>`COALESCE((
        SELECT CASE MIN(CASE rt.confidence_level
          WHEN 'new' THEN 0 WHEN 'learning' THEN 1
          WHEN 'reviewing' THEN 2 WHEN 'known' THEN 3
        END)
          WHEN 0 THEN 'new' WHEN 1 THEN 'learning'
          WHEN 2 THEN 'reviewing' WHEN 3 THEN 'known'
        END
        FROM ${reviewTracks} rt
        WHERE rt.item_id = ${kanji.id} AND rt.item_type = 'kanji'
      ), 'new')`.as("confidence"),
    })
    .from(kanji)
    .where(eq(kanji.userId, userId));

  const bySource = new Map<string, ConfidenceLevel[]>();
  for (const k of kanjiRows) {
    for (const sid of k.sourceImageIds) {
      const arr = bySource.get(sid) ?? [];
      arr.push(k.confidence as ConfidenceLevel);
      bySource.set(sid, arr);
    }
  }

  return sources.map((s) => {
    const confidences = bySource.get(s.id) ?? [];
    return {
      id: s.id,
      name: s.name ?? getDefaultSourceName(s.uploadedAt),
      uploadedAt: s.uploadedAt.toISOString(),
      hasImage: !!s.imageUrl,
      progress: getSourceProgress(confidences),
    };
  });
}
