import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { NormalizedHackathon } from "@/lib/aggregator/types";
import { calculateRegistrationStatus } from "@/lib/aggregator/deduplication";

const PAGE_SIZE = 500;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query")?.toLowerCase().trim() || "";
  const mode = searchParams.get("mode") || "all";
  const source = searchParams.get("source") || "all";
  const theme = searchParams.get("theme") || "all";
  const status = searchParams.get("status") || "all";
  const featuredOnly = searchParams.get("featured") === "true";

  try {
    const supabase = getSupabaseAdminClient();
    const allEvents: NormalizedHackathon[] = [];

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("hackathons")
        .select("*")
        .eq("verified", true)
        .is("archived_at", null)
        .order("featured", { ascending: false })
        .order("start_date", { ascending: true, nullsFirst: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        if (error.code === "PGRST205") {
          console.warn("[API:Hackathons] Hackathons table is not yet created in Supabase schema cache.");
          break;
        }
        throw new Error(`Could not load verified cached hackathons: ${error.message}`);
      }

      const page = (data || []) as NormalizedHackathon[];
      allEvents.push(...page);
      if (page.length < PAGE_SIZE) break;
    }

    // Fetch sync state
    const { data: syncState, error: stateError } = await supabase
      .from("hackathon_sync_state")
      .select("status,last_sync_completed_at,total_discovered")
      .eq("source", "global")
      .maybeSingle();
    if (stateError) {
      console.error("[API:Hackathons] Could not load synchronization status:", stateError.message);
    }

    const currentEvents = allEvents.map((event) => ({
      ...event,
      registration_status: calculateRegistrationStatus(
        event.registration_deadline,
        event.registration_status
      ),
    }));

    const activeEvents = currentEvents.filter(
      (h) => h.registration_status === "Open" || h.registration_status === "Closing Soon"
    );
    const onlineCount = currentEvents.filter((h) => h.mode === "Online").length;
    const inPersonCount = currentEvents.filter((h) => h.mode === "In Person" || h.mode === "Hybrid").length;

    const totalPrizeUsd = currentEvents.reduce((acc, h) => acc + (Number(h.prize_usd) || 0), 0);
    const formattedPrizeSum =
      totalPrizeUsd >= 1_000_000
        ? `$${(totalPrizeUsd / 1_000_000).toFixed(1)}M+`
        : totalPrizeUsd >= 1000
          ? `$${Math.round(totalPrizeUsd / 1000)}k+`
          : `$${totalPrizeUsd.toLocaleString()}`;

    const uniqueOrganizers = new Set(
      currentEvents.map((h) => h.organizer).filter((organizer): organizer is string => Boolean(organizer))
    ).size;
    const uniqueSources = Array.from(new Set(currentEvents.map((h) => h.source_platform)));

    const hackathons = currentEvents.filter((h) => {
      if (mode !== "all" && h.mode !== mode) return false;
      if (source !== "all" && h.source_platform !== source) return false;
      if (status !== "all" && h.registration_status !== status) return false;
      if (featuredOnly && !h.featured) return false;
      if (
        theme !== "all" &&
        !(h.themes || []).some((eventTheme) => eventTheme.toLowerCase() === theme.toLowerCase())
      ) {
        return false;
      }
      if (!query) return true;

      return [
        h.title,
        h.organizer || "",
        h.description || "",
        ...(h.themes || []),
        ...(h.skills || []),
      ].some((value) => value.toLowerCase().includes(query));
    });

    return NextResponse.json({
      hackathons,
      total: hackathons.length,
      stats: {
        totalActive: activeEvents.length,
        totalCount: currentEvents.length,
        onlineCount,
        inPersonCount,
        formattedPrizeSum,
        totalPrizeUsd,
        uniqueOrganizers,
        sources: uniqueSources,
      },
      sync: {
        status: syncState?.status || (stateError ? "unknown" : "idle"),
        lastSyncCompletedAt: syncState?.last_sync_completed_at || null,
        totalDiscovered: syncState?.total_discovered ?? currentEvents.length,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[API:Hackathons] Cached listing query failed:", message);
    return NextResponse.json({ error: "Hackathon cache is temporarily unavailable." }, { status: 503 });
  }
}
