import { eq } from "drizzle-orm";
import { db, users } from "@/db";

export type OnboardingTourStatus = "pending" | "in_progress" | "completed" | "skipped";

export const ONBOARDING_TOUR_STATUSES: readonly OnboardingTourStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "skipped",
] as const;

export async function getOnboardingStatus(userId: string): Promise<{
  status: OnboardingTourStatus;
  welcomeStartedAt: Date | null;
}> {
  const [row] = await db
    .select({
      status: users.onboardingTourStatus,
      welcomeStartedAt: users.welcomeStartedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) return { status: "pending", welcomeStartedAt: null };
  return {
    status: row.status as OnboardingTourStatus,
    welcomeStartedAt: row.welcomeStartedAt,
  };
}

export async function markInProgress(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      onboardingTourStatus: "in_progress",
      welcomeStartedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function markCompleted(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ onboardingTourStatus: "completed" })
    .where(eq(users.id, userId));
}

export async function markSkipped(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ onboardingTourStatus: "skipped" })
    .where(eq(users.id, userId));
}

export async function resetToPending(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      onboardingTourStatus: "pending",
      welcomeStartedAt: null,
    })
    .where(eq(users.id, userId));
}
