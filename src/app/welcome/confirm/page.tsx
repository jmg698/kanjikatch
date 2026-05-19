import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, sourceImages } from "@/db";
import { ensureUserRow } from "@/lib/ensure-user";
import { getOnboardingStatus } from "@/lib/onboarding";
import { isKnownSample, loadSample } from "@/lib/samples";
import { ConfirmFlow } from "./confirm-flow";

export const dynamic = "force-dynamic";

export default async function WelcomeConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; sourceId?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  await ensureUserRow(userId);
  const { status } = await getOnboardingStatus(userId);
  if (status === "completed" || status === "skipped") redirect("/dashboard");

  const params = await searchParams;
  const slug = params.slug ?? "";
  const sourceId = params.sourceId ?? "";

  if (!isKnownSample(slug) || !sourceId) {
    redirect("/welcome");
  }

  // Ownership + sample-ness check. Without this, a crafted URL could let
  // someone confirm against a source row they don't own — the save endpoint
  // would reject it later, but failing fast here keeps the flow honest.
  const [source] = await db
    .select({
      id: sourceImages.id,
      isOnboardingSample: sourceImages.isOnboardingSample,
      processed: sourceImages.processed,
    })
    .from(sourceImages)
    .where(and(eq(sourceImages.id, sourceId), eq(sourceImages.userId, userId)))
    .limit(1);

  if (!source || !source.isOnboardingSample) {
    redirect("/welcome");
  }

  // If the user re-navigated here after already saving, send them onward
  // rather than letting them double-save.
  if (source.processed) {
    redirect("/review?size=5&onboarding=1");
  }

  const sample = await loadSample(slug);

  return (
    <ConfirmFlow
      sourceId={sourceId}
      label={sample.label}
      imagePath={sample.imagePath}
      extraction={{
        kanji: sample.kanji,
        vocabulary: sample.vocabulary,
        sentences: sample.sentences,
      }}
    />
  );
}
