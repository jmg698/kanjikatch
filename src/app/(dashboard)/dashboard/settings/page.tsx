import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { db, users } from "@/db";
import { getCurrentUserId } from "@/lib/auth";
import { ensureUserRow } from "@/lib/ensure-user";
import { DangerZone } from "./danger-zone";
import { ExportButton } from "./export-button";

export const metadata = {
  title: "Settings — KanjiKatch",
};

export default async function SettingsPage() {
  const userId = await getCurrentUserId();
  await ensureUserRow(userId);

  const [clerkUser, [row]] = await Promise.all([
    currentUser(),
    db
      .select({
        email: users.email,
        subscriptionTier: users.subscriptionTier,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  ]);

  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ??
    clerkUser?.emailAddresses?.[0]?.emailAddress ??
    row?.email ??
    "(unknown)";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your account, your data, and your subscription.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-mono">
            Account
          </p>
          <div className="grid sm:grid-cols-[120px_1fr] gap-2 sm:gap-4 text-sm">
            <span className="text-muted-foreground">Email</span>
            <span>{email}</span>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            To change your email or password, use your account menu in the top-right.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-mono">
            Subscription
          </p>
          <p className="text-sm text-muted-foreground">
            Update your plan, payment method, or invoices on the billing page.
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/billing">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open billing
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-mono">
            Your data
          </p>
          <p className="text-sm text-muted-foreground">
            Download a JSON file with your library, review history, sentences,
            and account profile. Stripe billing identifiers and Anthropic cost
            logs are not included — see the{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>{" "}
            for what we keep and why.
          </p>
          <ExportButton />
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardContent className="pt-6 space-y-3">
          <p className="text-xs uppercase tracking-wide text-destructive font-mono">
            Danger zone
          </p>
          <p className="text-sm text-muted-foreground">
            Permanently delete your account, library, sentences, review history,
            and source images. This cannot be undone. If you have an active Pro
            subscription, cancel it on the billing page first to avoid being
            charged for an unused period.
          </p>
          <DangerZone />
        </CardContent>
      </Card>
    </div>
  );
}
