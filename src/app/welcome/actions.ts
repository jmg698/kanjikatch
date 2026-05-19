"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { db, sourceImages } from "@/db";
import { ensureUserRow } from "@/lib/ensure-user";
import { loadSample } from "@/lib/samples";
import {
  markInProgress,
  markCompleted,
  markSkipped,
} from "@/lib/onboarding";

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
    // Validate the sample exists before creating any rows. loadSample
    // throws if the JSON is missing or malformed.
    const sample = await loadSample(slug);

    const [source] = await db
      .insert(sourceImages)
      .values({
        userId,
        name: sample.label,
        imageUrl: null,
        sourceText: null,
        // processed flips to true when /api/extract/save runs after the
        // user confirms on /welcome/confirm. Keeping it false here lets the
        // save endpoint's idempotency check fire normally.
        processed: false,
        isOnboardingSample: true,
      })
      .returning({ id: sourceImages.id });

    sourceId = source.id;
  } catch (err) {
    Sentry.captureException(err);
    throw new Error("Could not load sample. Please try again.");
  }

  // Hand off to the confirmation step instead of writing cards here. The
  // user reviews the pre-extracted list, deselects anything they don't want,
  // and the existing /api/extract/save endpoint writes the rows. See
  // ONBOARDING_PLAN.md Phase 2.0 item 3.
  redirect(`/welcome/confirm?slug=${encodeURIComponent(slug)}&sourceId=${sourceId}`);
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
