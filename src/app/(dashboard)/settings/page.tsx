import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import { DataExportButton } from "./data-export-button";
import { DeleteAccountSection } from "./delete-account-section";

export const metadata = {
  title: "Settings — KanjiKatch",
};

export default async function SettingsPage() {
  const userId = await getCurrentUserId();
  const clerkUser = await currentUser();

  const [userRow] = await db
    .select({
      email: users.email,
      createdAt: users.createdAt,
      subscriptionTier: users.subscriptionTier,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRow) {
    redirect("/dashboard");
  }

  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? userRow.email;
  const displayName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ").trim();
  const memberSince = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(userRow.createdAt);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your account, your data, your subscription.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-mono">
            Profile
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium mt-1 break-all">{email}</p>
            </div>
            {displayName && (
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium mt-1">{displayName}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Member since</p>
              <p className="text-sm font-medium mt-1">{memberSince}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Plan</p>
              <p className="text-sm font-medium mt-1 capitalize">
                {userRow.subscriptionTier === "pro_comped" ? "Pro (comped)" : userRow.subscriptionTier}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            To change your email or password, use the avatar menu in the top
            right — those are managed by our auth provider.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-mono">
              Subscription
            </p>
            <p className="text-sm mt-2 text-muted-foreground">
              Manage billing, view invoices, or cancel from the billing page.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard/billing">Open billing</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-mono">
              Your data
            </p>
            <p className="text-sm mt-2 text-muted-foreground">
              Download a JSON archive of everything in your account — kanji,
              vocab, sentences, review history. Billing records live in
              Stripe and can be exported from there.
            </p>
          </div>
          <DataExportButton />
        </CardContent>
      </Card>

      <DeleteAccountSection email={email} />

      <p className="text-xs text-muted-foreground text-center pt-2">
        Need help? Email{" "}
        <a
          href="mailto:support@kanjikatch.com"
          className="underline hover:text-foreground"
        >
          support@kanjikatch.com
        </a>
        .
      </p>
    </div>
  );
}
