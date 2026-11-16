import { NextRequest, NextResponse } from "next/server";
import { runHackathonAggregatorSync } from "@/lib/aggregator";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireHackathonCurator, curatorErrorResponse } from "@/lib/hackathon-curators";

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
 * Curator-only — automated ingestion stays disabled until a source is
 * authorized, and catalog maintenance is a curator responsibility.
 */
export async function POST(req: NextRequest) {
  try {
    await requireHackathonCurator(req);
  } catch (err: unknown) {
    return curatorErrorResponse(err);
  }

  try {
    const result = await runHackathonAggregatorSync();

    // Soft-archive long-expired events after a refresh. Never deletes rows;
    // bookmarks survive and archived events stay linkable with an "ended" banner.
    let archivedExpired: number | null = null;
    try {
      const supabase = getSupabaseAdminClient();
      const { data: archivedCount, error: archiveError } = await supabase.rpc("archive_expired_hackathons");
      if (archiveError) {
        console.error("[API:Hackathons:sync] Expiry archival failed:", archiveError.message);
      } else {
        archivedExpired = typeof archivedCount === "number" ? archivedCount : Number(archivedCount) || 0;
      }
    } catch (archiveError: unknown) {
      console.error(
        "[API:Hackathons:sync] Expiry archival failed:",
        archiveError instanceof Error ? archiveError.message : String(archiveError)
      );
    }

    if (result.status === "locked") {
      return NextResponse.json({ ...result, archivedExpired }, { status: 409 });
    }

    if (result.status === "cooldown") {
      return NextResponse.json({ ...result, archivedExpired }, { status: 200 });
    }

    if (!result.success) {
      const status = result.status === "unavailable" ? 503 : result.status === "partial" ? 502 : 500;
      return NextResponse.json({ ...result, archivedExpired }, { status });
    }

    return NextResponse.json({ ...result, archivedExpired }, { status: 200 });
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
