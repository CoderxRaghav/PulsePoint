import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  requireHackathonCurator,
  curatorErrorResponse,
} from "@/lib/hackathon-curators";
import { validateCuratedHackathon } from "@/lib/hackathon-validation";
import { findDedupMatches, writeHackathonAuditLog } from "@/lib/hackathon-db";
import { calculateRegistrationStatus, computeSyncHash } from "@/lib/aggregator/deduplication";

const BODY_LIMIT = 64 * 1024;
const ADMIN_SELECT = [
  // Full row minus nothing sensitive — curator-only surface.
  "id, slug, title, organizer, source_platform, source_url, apply_url, banner_url, mode, location,",
  "registration_status, registration_deadline, start_date, end_date, prize_pool, prize_usd,",
  "themes, skills, team_size_min, team_size_max, description, eligibility, featured, verified,",
  "verified_at, discovered_at, updated_at, archived_at, submitted_by, curation_notes, sync_hash",
].join(" ");

/**
 * GET /api/admin/hackathons
 * Curator-only catalog view: includes unverified, expired and archived rows.
 */
export async function GET(req: NextRequest) {
  try {
    await requireHackathonCurator(req);
  } catch (err: unknown) {
    return curatorErrorResponse(err);
  }

  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("query") || "").trim().slice(0, 120);
  const scope = searchParams.get("scope") || "all"; // all | live | unverified | archived
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(60, Math.max(1, Number(searchParams.get("pageSize")) || 24));

  try {
    const supabase = getSupabaseAdminClient();
    let qb = supabase.from("hackathons").select(ADMIN_SELECT, { count: "exact" });

    if (scope === "live") qb = qb.eq("verified", true).is("archived_at", null);
    else if (scope === "unverified") qb = qb.eq("verified", false);
    else if (scope === "archived") qb = qb.not("archived_at", "is", null);

    if (query) {
      qb = qb.or(`title.ilike.%${query}%,organizer.ilike.%${query}%`);
    }
    qb = qb
      .order("archived_at", { ascending: true, nullsFirst: true })
      .order("verified_at", { ascending: false, nullsFirst: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await qb;
    if (error) throw new Error(`Could not load catalog: ${error.message}`);

    return NextResponse.json(
      { hackathons: data || [], total: count ?? 0, page, pageSize },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[API:Admin:Hackathons] Catalog query failed:", message);
    return NextResponse.json({ error: "Could not load the curator catalog." }, { status: 503 });
  }
}

/**
 * POST /api/admin/hackathons
 * Creates a curated listing. Nothing here is fabricated — the curator supplies
 * every field, and entries always cite official URLs. Duplicate detection runs
 * on the canonical slug; pass confirm_duplicate: true to publish through a
 * known match.
 */
export async function POST(req: NextRequest) {
  let uid: string;
  try {
    uid = await requireHackathonCurator(req);
  } catch (err: unknown) {
    return curatorErrorResponse(err);
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > BODY_LIMIT) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    const text = await req.text();
    if (new TextEncoder().encode(text).byteLength > BODY_LIMIT) {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "A JSON object body is required." }, { status: 400 });
  }
  const record = body as Record<string, unknown>;
  const confirmDuplicate = record.confirm_duplicate === true;
  const allowExpired = record.allow_expired === true;

  const parsed = validateCuratedHackathon(record, { allowExpired });
  if (!parsed.ok) {
    return NextResponse.json({ error: "Listing is invalid.", details: parsed.errors }, { status: 400 });
  }
  const value = parsed.value;

  try {
    const supabase = getSupabaseAdminClient();

    const matches = await findDedupMatches(supabase, value.title);
    if (matches.length > 0 && !confirmDuplicate) {
      return NextResponse.json(
        {
          error: "Potential duplicate listing detected. Review the matches, then resubmit with confirm_duplicate: true if this is a distinct event.",
          matches,
        },
        { status: 409 }
      );
    }

    const id = `curated-${value.slug}`;
    const status = calculateRegistrationStatus(
      value.registration_deadline ?? undefined,
      "Unknown"
    );
    const nowIso = new Date().toISOString();
    const row = {
      id,
      source_event_id: value.slug,
      slug: value.slug,
      title: value.title,
      organizer: value.organizer,
      source_platform: "Curated",
      source_url: value.source_url,
      apply_url: value.apply_url,
      banner_url: value.banner_url,
      mode: value.mode,
      location: value.location,
      registration_status: status,
      registration_deadline: value.registration_deadline,
      start_date: value.start_date,
      end_date: value.end_date,
      prize_pool: value.prize_pool,
      prize_usd: value.prize_usd,
      themes: value.themes,
      skills: value.skills,
      team_size_min: value.team_size_min,
      team_size_max: value.team_size_max,
      description: value.description,
      eligibility: value.eligibility,
      featured: value.featured,
      verified: true,
      verified_at: nowIso,
      discovered_at: nowIso,
      last_seen_at: nowIso,
      archived_at: null,
      submitted_by: uid,
      curation_notes: value.curation_notes,
      sync_hash: computeSyncHash({
        title: value.title,
        organizer: value.organizer ?? undefined,
        mode: value.mode ?? undefined,
        registration_status: status,
        registration_deadline: value.registration_deadline ?? undefined,
        start_date: value.start_date ?? undefined,
        end_date: value.end_date ?? undefined,
        prize_pool: value.prize_pool ?? undefined,
        apply_url: value.apply_url,
        themes: value.themes,
      }),
    };

    const { error: insertError } = await supabase.from("hackathons").insert(row);
    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: `A listing with slug "${value.slug}" already exists. Edit it instead, or adjust the title/slug.` },
          { status: 409 }
        );
      }
      throw new Error(`Could not create the listing: ${insertError.message}`);
    }

    await writeHackathonAuditLog(supabase, {
      actorUid: uid,
      action: "create",
      hackathonId: id,
      diff: { title: value.title, apply_url: value.apply_url, slug: value.slug },
    });

    return NextResponse.json({ hackathon: { id, slug: value.slug } }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[API:Admin:Hackathons] Create failed:", message);
    return NextResponse.json({ error: "Could not create the listing. Please try again." }, { status: 503 });
  }
}
