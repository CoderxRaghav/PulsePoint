import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { NormalizedHackathon } from "@/lib/aggregator/types";
import { calculateRegistrationStatus } from "@/lib/aggregator/deduplication";
import { getHackathonPhase } from "@/lib/hackathon-status";
import { PUBLIC_HACKATHON_SELECT } from "@/lib/hackathon-db";

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 60;
const STATS_COLUMNS = "prize_usd, organizer, source_platform, mode, registration_deadline";
const QUERY_SANITIZER = /[%_(),."\\]/g;

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  // Number(null) is 0 (finite) — treat a missing/empty parameter as absent.
  if (raw == null || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function sanitizeQuery(raw: string | null): string {
  if (!raw) return "";
  return raw.replace(QUERY_SANITIZER, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = sanitizeQuery(searchParams.get("query"));
  const mode = searchParams.get("mode") || "all";
  const source = searchParams.get("source") || "all";
  const theme = searchParams.get("theme") || "all";
  const status = searchParams.get("status") || "all";
  const featuredOnly = searchParams.get("featured") === "true";
  const showClosed =
    searchParams.get("include_closed") === "true" || status === "Closed";
  const deadlineBeforeRaw = searchParams.get("deadline_before");
  const sort = searchParams.get("sort") || "deadline";
  const page = clampInt(searchParams.get("page"), 1, 1, 1000);
  const pageSize = clampInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);

  let deadlineBefore: string | null = null;
  if (deadlineBeforeRaw) {
    const parsed = Date.parse(deadlineBeforeRaw);
    if (Number.isNaN(parsed)) {
      return NextResponse.json({ error: "deadline_before must be an ISO 8601 date." }, { status: 400 });
    }
    deadlineBefore = new Date(parsed).toISOString();
  }

  const nowIso = new Date().toISOString();
  const closingSoonIso = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

  try {
    const supabase = getSupabaseAdminClient();

    // ---- Page query (all filtering happens in SQL) --------------------------
    let pageQuery = supabase
      .from("hackathons")
      .select(PUBLIC_HACKATHON_SELECT, { count: "exact" })
      .eq("verified", true)
      .is("archived_at", null);

    if (!showClosed) {
      pageQuery = pageQuery.or(`registration_deadline.is.null,registration_deadline.gte.${nowIso}`);
    }
    if (deadlineBefore) {
      pageQuery = pageQuery.lte("registration_deadline", deadlineBefore);
    }
    if (mode !== "all") pageQuery = pageQuery.eq("mode", mode);
    if (source !== "all") pageQuery = pageQuery.eq("source_platform", source);
    if (featuredOnly) pageQuery = pageQuery.eq("featured", true);
    if (theme !== "all") {
      // Exact, case-sensitive match on theme tag; theme values come from a
      // fixed curated vocabulary.
      pageQuery = pageQuery.contains("themes", [theme]);
    }
    if (status === "Open") {
      // Events without a published deadline are Unknown, never implicitly Open.
      pageQuery = pageQuery.gt("registration_deadline", closingSoonIso);
    } else if (status === "Closing Soon") {
      pageQuery = pageQuery.gte("registration_deadline", nowIso).lte("registration_deadline", closingSoonIso);
    } else if (status === "Closed") {
      pageQuery = pageQuery.lt("registration_deadline", nowIso);
    } else if (status === "Unknown") {
      pageQuery = pageQuery.is("registration_deadline", null);
    }
    if (query) {
      pageQuery = pageQuery.or(
        `title.ilike.%${query}%,organizer.ilike.%${query}%,description.ilike.%${query}%,eligibility.ilike.%${query}%`
      );
    }

    if (sort === "prize") {
      pageQuery = pageQuery
        .order("featured", { ascending: false })
        .order("prize_usd", { ascending: false, nullsFirst: false });
    } else if (sort === "latest") {
      pageQuery = pageQuery
        .order("featured", { ascending: false })
        .order("discovered_at", { ascending: false });
    } else {
      pageQuery = pageQuery
        .order("featured", { ascending: false })
        .order("registration_deadline", { ascending: true, nullsFirst: false });
    }

    const from = (page - 1) * pageSize;
    pageQuery = pageQuery.range(from, from + pageSize - 1);

    const { data, error, count } = await pageQuery;
    if (error) {
      throw new Error(`Could not load verified cached hackathons: ${error.message}`);
    }

    // ---- Stats (lightweight columns only, independent of filters) -----------
    const { data: statsRows, error: statsError } = await supabase
      .from("hackathons")
      .select(STATS_COLUMNS)
      .eq("verified", true)
      .is("archived_at", null);
    if (statsError) {
      throw new Error(`Could not compute catalog statistics: ${statsError.message}`);
    }

    const statRows = (statsRows || []) as Array<{
      prize_usd: number | string | null;
      organizer: string | null;
      source_platform: string | null;
      mode: string | null;
      registration_deadline: string | null;
    }>;
    const nowMs = Date.now();
    const liveRows = statRows.filter((row) => {
      // Counted as live only when a deadline is known and still in the future.
      // Unknown-deadline rows are excluded — we cannot claim their registration is live.
      if (!row.registration_deadline) return false;
      const deadline = Date.parse(row.registration_deadline);
      return !Number.isNaN(deadline) && deadline >= nowMs;
    });

    const onlineCount = liveRows.filter((row) => row.mode === "Online").length;
    const inPersonCount = liveRows.filter(
      (row) => row.mode === "In Person" || row.mode === "Hybrid"
    ).length;
    const totalPrizeUsd = liveRows.reduce((acc, row) => acc + (Number(row.prize_usd) || 0), 0);
    const formattedPrizeSum =
      totalPrizeUsd >= 1_000_000
        ? `$${(totalPrizeUsd / 1_000_000).toFixed(1)}M+`
        : totalPrizeUsd >= 1000
          ? `$${Math.round(totalPrizeUsd / 1000)}k+`
          : `$${totalPrizeUsd.toLocaleString()}`;
    const uniqueOrganizers = new Set(
      liveRows.map((row) => row.organizer).filter((organizer): organizer is string => Boolean(organizer))
    ).size;
    const uniqueSources = Array.from(
      new Set(liveRows.map((row) => row.source_platform).filter((s): s is string => Boolean(s)))
    );

    // ---- Sync state ----------------------------------------------------------
    const { data: syncState, error: stateError } = await supabase
      .from("hackathon_sync_state")
      .select("status,last_sync_completed_at,total_discovered")
      .eq("source", "global")
      .maybeSingle();
    if (stateError) {
      console.error("[API:Hackathons] Could not load synchronization status:", stateError.message);
    }

    const hackathons = ((data || []) as unknown as NormalizedHackathon[]).map((event) => ({
      ...event,
      registration_status: calculateRegistrationStatus(
        event.registration_deadline,
        event.registration_status
      ),
      phase: getHackathonPhase(event),
    }));

    return NextResponse.json(
      {
        hackathons,
        total: count ?? hackathons.length,
        page,
        pageSize,
        includeClosed: showClosed,
        stats: {
          totalActive: liveRows.length,
          totalCount: liveRows.length,
          onlineCount,
          inPersonCount,
          formattedPrizeSum,
          totalPrizeUsd,
          uniqueOrganizers,
          sources: uniqueSources,
          totalLive: liveRows.length,
          totalClosed: statRows.length - liveRows.length,
          totalAll: statRows.length,
        },
        sync: {
          status: syncState?.status || (stateError ? "unknown" : "idle"),
          lastSyncCompletedAt: syncState?.last_sync_completed_at || null,
          totalDiscovered: syncState?.total_discovered ?? statRows.length,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: unknown) {
    if (err instanceof Error && /bail out of prerendering|prerender/i.test(err.message)) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[API:Hackathons] Cached listing query failed:", message);
    return NextResponse.json({ error: "Hackathon cache is temporarily unavailable." }, { status: 503 });
  }
}
