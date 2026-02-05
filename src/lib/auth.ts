import { auth } from "@clerk/nextjs/server";

export async function getCurrentUserId(): Promise<string> {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error("Unauthorized");
  }
  
  return userId;
}

export async function getOptionalUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}
