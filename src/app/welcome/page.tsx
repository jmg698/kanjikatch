import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ensureUserRow } from "@/lib/ensure-user";
import { getOnboardingStatus } from "@/lib/onboarding";
import { WelcomeFlow } from "./welcome-flow";

export const dynamic = "force-dynamic";

const TIME_GUARDRAIL_MS = 7 * 60 * 1000;

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  await ensureUserRow(userId);
  const { status, welcomeStartedAt } = await getOnboardingStatus(userId);

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

  // Time guardrail: if the user has been mid-tour for >7 minutes without
  // reaching the wild reveal, surface a soft "stuck? try a sample" nudge.
  // See ONBOARDING_PLAN.md §9 failure modes.
  const isStuck =
    status === "in_progress" &&
    welcomeStartedAt !== null &&
    Date.now() - welcomeStartedAt.getTime() > TIME_GUARDRAIL_MS;

  return <WelcomeFlow initialStep={initialStep} showTimeGuardrail={isStuck} />;
}
