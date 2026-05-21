"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, sourceImages } from "@/db";
import { ensureUserRow } from "@/lib/ensure-user";
import { resetToPending } from "@/lib/onboarding";

export async function replayOnboarding(): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  await ensureUserRow(userId);
  await resetToPending(userId);
  redirect("/welcome");
}

export async function removeOnboardingSamples(): Promise<{ removed: number }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Cascade FK from kanji/vocabulary to source_images via sourceImageIds
  // array is non-trivial, so we delete the source row and live with
  // orphaned card rows referencing a now-missing source. The card rows
  // themselves are harmless — they continue to appear in the library
  // exactly as if the user had captured them organically. A future,
  // cleaner cascade can de-duplicate that array.
  const result = await db
    .delete(sourceImages)
    .where(
      and(
        eq(sourceImages.userId, userId),
        eq(sourceImages.isOnboardingSample, true),
      ),
    )
    .returning({ id: sourceImages.id });

  revalidatePath("/dashboard/settings");
  revalidatePath("/library");
  revalidatePath("/dashboard");
  return { removed: result.length };
}
