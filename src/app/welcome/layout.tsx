import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function WelcomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div
      className="min-h-screen text-foreground"
      style={{
        background:
          "radial-gradient(60% 50% at 20% 10%, hsl(35 40% 94%) 0%, transparent 60%), radial-gradient(50% 40% at 90% 20%, hsl(150 30% 94%) 0%, transparent 60%), hsl(35 28% 97%)",
      }}
    >
      <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">{children}</main>
    </div>
  );
}
