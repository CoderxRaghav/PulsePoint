import { NextRequest, NextResponse } from "next/server";
import { runHackathonAggregatorSync } from "@/lib/aggregator";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";

/**
 * GET /api/hackathons/sync
 * Returns the current synchronization status, last updated timestamp, and provider metrics.
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    const { data: syncState, error } = await supabase
      .from("hackathon_sync_state")
      .select(
        "status,last_sync_completed_at,last_successful_sync_at,last_sync_started_at,total_discovered,total_inserted,total_updated,total_unchanged,total_failed,metadata,last_error"
      )
      .eq("source", "global")
      .maybeSingle();

    if (error) {
      throw new Error(`Could not load global synchronization state: ${error.message}`);
    }

    return NextResponse.json({
      status: syncState?.status || "idle",
      lastSyncCompletedAt: syncState?.last_sync_completed_at || null,
      lastSuccessfulSyncAt: syncState?.last_successful_sync_at || null,
      lastSyncStartedAt: syncState?.last_sync_started_at || null,
      totalDiscovered: syncState?.total_discovered || 0,
      totalInserted: syncState?.total_inserted || 0,
      totalUpdated: syncState?.total_updated || 0,
      totalUnchanged: syncState?.total_unchanged || 0,
      totalFailed: syncState?.total_failed || 0,
      metadata: syncState?.metadata || {},
      lastError: syncState?.last_error || null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { status: "unknown", lastSyncCompletedAt: null, error: msg },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hackathons/sync
 * Triggers a global multi-source refresh with lock and cooldown guards.
 */
export async function POST(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json(
      { success: false, status: "error", message: "Authentication is required to refresh listings." },
      { status: 401 }
    );
  }

  try {
    await verifyFirebaseIdToken(token);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not configured")) {
      console.error("[API:Hackathons:sync] Firebase Admin configuration is missing.");
      return NextResponse.json(
        { success: false, status: "error", message: "Refresh authentication is unavailable." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, status: "error", message: "The Firebase ID token is invalid or expired." },
      { status: 401 }
    );
  }

  try {
    const result = await runHackathonAggregatorSync();

    if (result.status === "locked") {
      return NextResponse.json(result, { status: 409 });
    }

    if (result.status === "cooldown") {
      return NextResponse.json(result, { status: 200 });
    }

    if (!result.success) {
      const status = result.status === "unavailable" ? 503 : result.status === "partial" ? 502 : 500;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        status: "error",
        message: `Internal aggregator synchronization failed: ${msg}`,
      },
      { status: 500 }
    );
  }
}
