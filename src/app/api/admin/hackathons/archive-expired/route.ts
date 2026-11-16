import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireHackathonCurator, curatorErrorResponse } from "@/lib/hackathon-curators";
import { writeHackathonAuditLog } from "@/lib/hackathon-db";

/**
 * POST /api/admin/hackathons/archive-expired
 * Curator-only. Soft-archives events whose last known date passed ≥ 14 days
 * ago. Never deletes rows; bookmarks survive.
 */
export async function POST(req: NextRequest) {
  let uid: string;
  try {
    uid = await requireHackathonCurator(req);
  } catch (err: unknown) {
    return curatorErrorResponse(err);
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc("archive_expired_hackathons");
    if (error) {
      throw new Error(`Archival failed: ${error.message}`);
    }
    const archived = typeof data === "number" ? data : Number(data) || 0;

    await writeHackathonAuditLog(supabase, {
      actorUid: uid,
      action: "archive_expired",
      diff: { archived },
    });

    return NextResponse.json({ archived });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[API:Admin:archive-expired] Failed:", message);
    return NextResponse.json({ error: "Could not archive expired events." }, { status: 503 });
  }
}
