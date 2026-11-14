import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { NormalizedHackathon } from "@/lib/aggregator/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing hackathon ID" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data: initialEvent, error } = await supabase
      .from("hackathons")
      .select("*")
      .eq("id", id)
      .eq("verified", true)
      .is("archived_at", null)
      .maybeSingle();
    if (error) {
      throw new Error(`Could not load hackathon details: ${error.message}`);
    }
    let event = initialEvent;

    if (!event) {
      const result = await supabase
        .from("hackathons")
        .select("*")
        .eq("slug", id)
        .eq("verified", true)
        .is("archived_at", null)
        .maybeSingle();
      if (result.error) {
        throw new Error(`Could not load hackathon details: ${result.error.message}`);
      }
      event = result.data;
    }

    if (!event) {
      return NextResponse.json({ error: "Hackathon not found" }, { status: 404 });
    }

    return NextResponse.json({ hackathon: event as NormalizedHackathon });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[API:Hackathons:id] Cached detail query failed:", message);
    return NextResponse.json({ error: "Hackathon details are temporarily unavailable." }, { status: 503 });
  }
}
