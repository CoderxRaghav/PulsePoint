import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { NormalizedHackathon } from "@/lib/aggregator/types";
import { calculateRegistrationStatus } from "@/lib/aggregator/deduplication";
import { getHackathonPhase } from "@/lib/hackathon-status";
import { PUBLIC_HACKATHON_SELECT } from "@/lib/hackathon-db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || id.length > 120) {
    return NextResponse.json({ error: "Missing or invalid hackathon ID" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    // Verified rows only. Archived rows stay reachable (bookmarks must keep
    // working) — the client renders an "ended" banner for them. Drafts
    // (verified = false) are never served.
    const { data: initialEvent, error } = await supabase
      .from("hackathons")
      .select(PUBLIC_HACKATHON_SELECT)
      .eq("id", id)
      .eq("verified", true)
      .maybeSingle();
    if (error) {
      throw new Error(`Could not load hackathon details: ${error.message}`);
    }
    let event = initialEvent;

    if (!event) {
      const result = await supabase
        .from("hackathons")
        .select(PUBLIC_HACKATHON_SELECT)
        .eq("slug", id)
        .eq("verified", true)
        .maybeSingle();
      if (result.error) {
        throw new Error(`Could not load hackathon details: ${result.error.message}`);
      }
      event = result.data;
    }

    if (!event) {
      return NextResponse.json({ error: "Hackathon not found" }, { status: 404 });
    }

    const row = event as unknown as NormalizedHackathon;
    return NextResponse.json(
      {
        hackathon: {
          ...row,
          registration_status: calculateRegistrationStatus(row.registration_deadline, row.registration_status),
          phase: getHackathonPhase(row),
          archived: Boolean(row.archived_at),
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: unknown) {
    if (err instanceof Error && /bail out of prerendering|prerender/i.test(err.message)) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[API:Hackathons:id] Cached detail query failed:", message);
    return NextResponse.json({ error: "Hackathon details are temporarily unavailable." }, { status: 503 });
  }
}
