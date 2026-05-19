import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ensureUserRow } from "@/lib/ensure-user";
import { getOnboardingStatus } from "@/lib/onboarding";
import { WelcomeFlow } from "./welcome-flow";

export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  await ensureUserRow(userId);
  const { status } = await getOnboardingStatus(userId);

  if (status === "completed" || status === "skipped") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const stepParam = params.step;

  // Status decides the default landing step. The user can also force a step
  // via ?step=summary (used when the review session completes and routes back).
  const initialStep: "pitch" | "source" | "summary" =
    stepParam === "summary"
      ? "summary"
      : status === "in_progress"
        ? "source"
        : "pitch";

  return <WelcomeFlow initialStep={initialStep} />;
}
