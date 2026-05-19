"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { promises as fs } from "fs";
import path from "path";
import { eq, sql, and } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { db, sourceImages, kanji, vocabulary } from "@/db";
import { ensureReviewTracks } from "@/lib/track-queries";
import { ensureUserRow } from "@/lib/ensure-user";
import { sqlTextArray } from "@/lib/pg-text-array";
import {
  markInProgress,
  markCompleted,
  markSkipped,
} from "@/lib/onboarding";

type SampleData = {
  slug: string;
  label: string;
  kanji: Array<{
    character: string;
    meanings: string[];
    readingsOn?: string[];
    readingsKun?: string[];
    jlptLevel?: number | null;
    strokeCount?: number | null;
  }>;
  vocabulary: Array<{
    word: string;
    reading: string;
    meanings: string[];
    partOfSpeech?: string | null;
    jlptLevel?: number | null;
  }>;
};

async function loadSample(slug: string): Promise<SampleData> {
  // Samples are baked into the deploy at public/samples/{slug}.json. Reading
  // them from disk in a server action is fine — they're tiny and cached by
  // the OS after the first hit.
  const file = path.join(process.cwd(), "public", "samples", `${slug}.json`);
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw) as SampleData;
}

export async function startWelcome(): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  await ensureUserRow(userId);
  await markInProgress(userId);
  revalidatePath("/welcome");
}

export async function chooseSampleSource(slug: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  await ensureUserRow(userId);

  let sourceId: string;

  try {
    const sample = await loadSample(slug);

    const [source] = await db
      .insert(sourceImages)
      .values({
        userId,
        name: sample.label,
        imageUrl: null,
        sourceText: null,
        processed: true,
        isOnboardingSample: true,
      })
      .returning({ id: sourceImages.id });

    sourceId = source.id;

    for (const k of sample.kanji) {
      const newMeanings = k.meanings;
      const newOn = k.readingsOn ?? [];
      const newKun = k.readingsKun ?? [];
      const [row] = await db
        .insert(kanji)
        .values({
          userId,
          character: k.character,
          meanings: newMeanings,
          readingsOn: newOn,
          readingsKun: newKun,
          jlptLevel: k.jlptLevel ?? null,
          strokeCount: k.strokeCount ?? null,
          sourceImageIds: [sourceId],
          timesSeen: 1,
        })
        .onConflictDoUpdate({
          target: [kanji.userId, kanji.character],
          set: {
            lastSeenAt: new Date(),
            timesSeen: sql`${kanji.timesSeen} + 1`,
            sourceImageIds: sql`array_append(${kanji.sourceImageIds}, ${sourceId}::uuid)`,
            meanings: sql`(SELECT coalesce(array_agg(DISTINCT val), '{}') FROM unnest(${kanji.meanings}::text[] || ${sqlTextArray(newMeanings)}) AS val)`,
            readingsOn: sql`(SELECT coalesce(array_agg(DISTINCT val), '{}') FROM unnest(${kanji.readingsOn}::text[] || ${sqlTextArray(newOn)}) AS val)`,
            readingsKun: sql`(SELECT coalesce(array_agg(DISTINCT val), '{}') FROM unnest(${kanji.readingsKun}::text[] || ${sqlTextArray(newKun)}) AS val)`,
          },
        })
        .returning({ id: kanji.id });
      await ensureReviewTracks(userId, row.id, "kanji");
    }

    for (const v of sample.vocabulary) {
      const newMeanings = v.meanings;
      const [row] = await db
        .insert(vocabulary)
        .values({
          userId,
          word: v.word,
          reading: v.reading,
          meanings: newMeanings,
          partOfSpeech: v.partOfSpeech ?? null,
          jlptLevel: v.jlptLevel ?? null,
          sourceImageIds: [sourceId],
          timesSeen: 1,
        })
        .onConflictDoUpdate({
          target: [vocabulary.userId, vocabulary.word, vocabulary.reading],
          set: {
            lastSeenAt: new Date(),
            timesSeen: sql`${vocabulary.timesSeen} + 1`,
            sourceImageIds: sql`array_append(${vocabulary.sourceImageIds}, ${sourceId}::uuid)`,
            meanings: sql`(SELECT coalesce(array_agg(DISTINCT val), '{}') FROM unnest(${vocabulary.meanings}::text[] || ${sqlTextArray(newMeanings)}) AS val)`,
            partOfSpeech: sql`coalesce(${v.partOfSpeech ?? null}, ${vocabulary.partOfSpeech})`,
          },
        })
        .returning({ id: vocabulary.id });
      await ensureReviewTracks(userId, row.id, "vocab");
    }
  } catch (err) {
    Sentry.captureException(err);
    throw new Error("Could not load sample. Please try again.");
  }

  // Route into the real review flow, capped at 5 cards. The review session
  // already supports `size=5`; the `onboarding=1` flag lets the summary
  // screen route the user back to /welcome on completion.
  redirect(`/review?size=5&onboarding=1`);
}

export async function skipOnboarding(): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  await ensureUserRow(userId);
  await markSkipped(userId);
  redirect("/dashboard");
}

export async function completeOnboarding(): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  await ensureUserRow(userId);
  await markCompleted(userId);
  redirect("/dashboard");
}

export async function removeOnboardingSamples(): Promise<{ removed: number }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Delete the source rows; cascading FK relationships and array_remove
  // handle the kanji/vocab cleanup. For Phase 1 we delete the source row
  // and let the kanji/vocab rows linger — they're harmless and the user
  // can manually delete them in the library. A future Package D iteration
  // will do a cleaner cascade.
  const result = await db
    .delete(sourceImages)
    .where(
      and(
        eq(sourceImages.userId, userId),
        eq(sourceImages.isOnboardingSample, true),
      ),
    )
    .returning({ id: sourceImages.id });

  revalidatePath("/library");
  revalidatePath("/dashboard");
  return { removed: result.length };
}
