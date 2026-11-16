import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireHackathonCurator, curatorErrorResponse } from "@/lib/hackathon-curators";

/**
 * GET /api/admin/hackathons/suggestions
 * Curator-only review queue. Default: open items (pending + approved), oldest first.
 */
export async function GET(req: NextRequest) {
  try {
    await requireHackathonCurator(req);
  } catch (err: unknown) {
    return curatorErrorResponse(err);
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "open"; // open | pending | approved | rejected | published | all
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize")) || 25));

  try {
    const supabase = getSupabaseAdminClient();
    let qb = supabase
      .from("hackathon_suggestions")
      .select(
        [
          "id, submitted_by, title, organizer, source_url, apply_url, mode, location,",
          "registration_deadline, start_date, end_date, prize_pool, description, eligibility,",
          "themes, status, reviewer_uid, review_notes, reviewed_at, published_hackathon_id,",
          "created_at, updated_at",
        ].join(" "),
        { count: "exact" }
      );

    if (status === "open") qb = qb.in("status", ["pending", "approved"]);
    else if (status !== "all") qb = qb.eq("status", status);

    qb = qb
      .order("created_at", { ascending: status === "open" || status === "pending" })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await qb;
    if (error) throw new Error(`Could not load suggestions: ${error.message}`);

    return NextResponse.json(
      { suggestions: data || [], total: count ?? 0, page, pageSize },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[API:Admin:Suggestions] Queue query failed:", message);
    return NextResponse.json({ error: "Could not load suggestions." }, { status: 503 });
  }
}
