import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { and, eq } from "drizzle-orm";
import { db, kanji, vocabulary } from "@/db";
import { itemTriageSchema } from "@/lib/validations";

/**
 * Card triage — move a kanji/vocab item between review states.
 *
 * Actions:
 *   - set_aside: pull the card out of rotation without grading it. Called from
 *     the review session; `reason` is captured at flag time because it routes
 *     the card (see below).
 *   - restore:   put it back in rotation. Used both by the in-session undo and
 *     by the library's "Keep it" action.
 *   - remove:    soft delete. The row stays so we don't orphan review_tracks /
 *     review_history / generated_sentence_targets (none of which have a foreign
 *     key to the item), and so a later capture of the same word doesn't
 *     resurrect something the user deliberately deleted.
 *
 * Notes:
 *   - review_tracks are deliberately left untouched. SRS state freezes where it
 *     was, so restoring a card resumes its schedule rather than resetting it.
 *   - reason 'bad_data' on a vocab item also queues it for re-enrichment by
 *     resetting the attempt counter, so the repair pass treats it as fresh. The
 *     caller kicks off the single-item repair; the cron sweep is the fallback.
 *     Kanji has no enrichment path yet, so a bad_data kanji is parked only and
 *     waits for manual editing.
 *   - restore does NOT clear needsEnrichment. If the user said the definition
 *     looked wrong, that's worth acting on whether or not the card stays in
 *     rotation.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = itemTriageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { action, itemId, itemType, reason } = parsed.data;
    const table = itemType === "kanji" ? kanji : vocabulary;
    const scope = and(eq(table.id, itemId), eq(table.userId, userId));

    // 'bad_data' on vocab re-opens the enrichment budget for this row. Attempts
    // reset to 0 so a row that already burned through MAX_ATTEMPTS on a bad
    // batch gets another shot now that a human has confirmed it's wrong.
    const queueRepair =
      action === "set_aside" && reason === "bad_data" && itemType === "vocab";

    const values =
      action === "set_aside"
        ? {
            reviewStatus: "set_aside",
            flagReason: reason ?? null,
            flaggedAt: new Date(),
            ...(queueRepair
              ? {
                  needsEnrichment: true,
                  enrichmentAttempts: 0,
                  lastEnrichmentAttemptAt: null,
                }
              : {}),
          }
        : {
            reviewStatus: action === "restore" ? "active" : "removed",
            flagReason: null,
            flaggedAt: null,
          };

    const [updated] = await db
      .update(table)
      .set(values)
      .where(scope)
      .returning({ id: table.id, reviewStatus: table.reviewStatus });

    if (!updated) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: updated.id,
      reviewStatus: updated.reviewStatus,
      // Tells the client whether to fire the single-item repair request.
      repairQueued: queueRepair,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Item triage error:", error);
    return NextResponse.json(
      { error: "Failed to update card" },
      { status: 500 },
    );
  }
}
