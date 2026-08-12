import { notFound } from "next/navigation";
import { z } from "zod";
import { db, studyGuides, sourceImages } from "@/db";
import { and, eq, inArray } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import { getDefaultSourceName } from "@/lib/mastery";
import { GuideView } from "@/components/guides/guide-view";

export default async function GuidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  if (!z.string().uuid().safeParse(id).success) {
    notFound();
  }

  const [guide] = await db
    .select()
    .from(studyGuides)
    .where(and(eq(studyGuides.id, id), eq(studyGuides.userId, userId)))
    .limit(1);

  if (!guide) {
    notFound();
  }

  const sources = guide.sourceImageIds.length > 0
    ? await db
        .select({ id: sourceImages.id, name: sourceImages.name, uploadedAt: sourceImages.uploadedAt })
        .from(sourceImages)
        .where(and(eq(sourceImages.userId, userId), inArray(sourceImages.id, guide.sourceImageIds)))
    : [];

  return (
    <GuideView
      guide={{
        id: guide.id,
        title: guide.title,
        contentMd: guide.contentMd,
        createdAt: guide.createdAt.toISOString(),
      }}
      sourceNames={sources.map((s) => s.name ?? getDefaultSourceName(s.uploadedAt))}
    />
  );
}
