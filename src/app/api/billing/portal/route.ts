import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { getAppUrl, getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [userRow] = await db
      .select({
        stripeCustomerId: users.stripeCustomerId,
        subscriptionTier: users.subscriptionTier,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRow?.stripeCustomerId) {
      // A user can only land here from /dashboard/billing, which we'll
      // hide for users with no customer record. Belt-and-suspenders block.
      return NextResponse.json(
        { error: "No billing record found for this account." },
        { status: 404 },
      );
    }

    if (userRow.subscriptionTier === "pro_comped") {
      return NextResponse.json(
        { error: "Comped accounts don't have a Stripe billing portal." },
        { status: 409 },
      );
    }

    const stripe = getStripe();
    const appUrl = getAppUrl();

    // Read an optional return path from the JSON body (defaults to billing
    // page). Stripe will bounce the user back here when they close the portal.
    let returnPath = "/dashboard/billing";
    try {
      const body = await req.json();
      if (body && typeof body.returnTo === "string") {
        const sanitized = sanitizeReturnPath(body.returnTo);
        if (sanitized) returnPath = sanitized;
      }
    } catch {
      // empty body is fine — use default
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: userRow.stripeCustomerId,
      return_url: `${appUrl}${returnPath}`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (err) {
    Sentry.captureException(err);
    console.error("[billing/portal] failed", err);
    return NextResponse.json(
      { error: "Failed to open billing portal." },
      { status: 500 },
    );
  }
}

function sanitizeReturnPath(input: string): string | null {
  if (!input.startsWith("/")) return null;
  if (input.startsWith("//")) return null;
  return input;
}
