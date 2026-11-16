import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireHackathonCurator, curatorErrorResponse } from "@/lib/hackathon-curators";
import { validateCuratedPatch } from "@/lib/hackathon-validation";
import { writeHackathonAuditLog } from "@/lib/hackathon-db";
import { calculateRegistrationStatus } from "@/lib/aggregator/deduplication";

const BODY_LIMIT = 64 * 1024;
const ADMIN_SELECT = [
  "id, slug, title, organizer, source_platform, source_url, apply_url, banner_url, mode, location,",
  "registration_status, registration_deadline, start_date, end_date, prize_pool, prize_usd,",
  "themes, skills, team_size_min, team_size_max, description, eligibility, featured, verified,",
  "verified_at, discovered_at, updated_at, archived_at, submitted_by, curation_notes, sync_hash",
].join(" ");

const CURATOR_ACTIONS = ["verify", "archive", "unarchive", "feature", "unfeature"] as const;
type CuratorAction = (typeof CURATOR_ACTIONS)[number];

async function readBody(req: NextRequest): Promise<{ value: Record<string, unknown> | null; error?: NextResponse }> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > BODY_LIMIT) {
    return { value: null, error: NextResponse.json({ error: "Request body is too large." }, { status: 413 }) };
  }
  try {
    const body = await req.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return { value: null, error: NextResponse.json({ error: "A JSON object body is required." }, { status: 400 }) };
    }
    return { value: body as Record<string, unknown> };
  } catch {
    return { value: null, error: NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 }) };
  }
}

/**
 * GET /api/admin/hackathons/[id]
 * Curator-only detail for the management console (includes curation fields).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireHackathonCurator(req);
  } catch (err: unknown) {
    return curatorErrorResponse(err);
  }
  const { id } = await params;
  if (!id || id.length > 120) {
    return NextResponse.json({ error: "Missing or invalid hackathon ID" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const firstAttempt = await supabase
      .from("hackathons")
      .select(ADMIN_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (firstAttempt.error) {
      throw new Error(`Could not load listing: ${firstAttempt.error.message}`);
    }
    let event = firstAttempt.data;

    if (!event) {
      const bySlug = await supabase.from("hackathons").select(ADMIN_SELECT).eq("slug", id).maybeSingle();
      if (bySlug.error) throw new Error(`Could not load listing: ${bySlug.error.message}`);
      event = bySlug.data;
    }
    if (!event) return NextResponse.json({ error: "Hackathon not found" }, { status: 404 });
    return NextResponse.json({ hackathon: event }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[API:Admin:Hackathons:id] GET failed:", message);
    return NextResponse.json({ error: "Could not load the listing." }, { status: 503 });
  }
}

/**
 * PATCH /api/admin/hackathons/[id]
 * Curator-only. Supports:
 *   { action: "verify" | "archive" | "unarchive" | "feature" | "unfeature" }
 *   { fields: { ...patch with the same validation rules as creation... } }
 *   or both together. Every change is written to hackathon_audit_log.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let uid: string;
  try {
    uid = await requireHackathonCurator(req);
  } catch (err: unknown) {
    return curatorErrorResponse(err);
  }
  const { id } = await params;
  if (!id || id.length > 120) {
    return NextResponse.json({ error: "Missing or invalid hackathon ID" }, { status: 400 });
  }

  const { value: body, error: bodyError } = await readBody(req);
  if (bodyError) return bodyError;
  if (!body) {
    return NextResponse.json({ error: "A JSON object body is required." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : null;
  if (action && !CURATOR_ACTIONS.includes(action as CuratorAction)) {
    return NextResponse.json(
      { error: `action must be one of: ${CURATOR_ACTIONS.join(", ")}.` },
      { status: 400 }
    );
  }

  const rawFields = body.fields;
  if (action === null && rawFields === undefined) {
    return NextResponse.json({ error: "Provide an action, fields, or both." }, { status: 400 });
  }

  let fieldPatch: Record<string, unknown> = {};
  if (rawFields !== undefined) {
    const parsed = validateCuratedPatch(rawFields);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Patch is invalid.", details: parsed.errors }, { status: 400 });
    }
    fieldPatch = { ...parsed.value };
    delete fieldPatch.slug; // link identifiers are never renamed
  }

  try {
    const supabase = getSupabaseAdminClient();
    const firstAttempt = await supabase
      .from("hackathons")
      .select("id, slug, title, verified, verified_at, featured, archived_at, registration_deadline, registration_status")
      .eq("id", id)
      .maybeSingle();
    if (firstAttempt.error) throw new Error(`Could not load listing: ${firstAttempt.error.message}`);
    let existing = firstAttempt.data;

    if (!existing) {
      const bySlug = await supabase
        .from("hackathons")
        .select("id, slug, title, verified, verified_at, featured, archived_at, registration_deadline, registration_status")
        .eq("slug", id)
        .maybeSingle();
      if (bySlug.error) throw new Error(`Could not load listing: ${bySlug.error.message}`);
      existing = bySlug.data;
    }
    if (!existing) {
      return NextResponse.json({ error: "Hackathon not found" }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const update: Record<string, unknown> = { ...fieldPatch };

    if (action === "verify") {
      update.verified = true;
      update.verified_at = nowIso;
    } else if (action === "archive") {
      update.archived_at = nowIso;
    } else if (action === "unarchive") {
      update.archived_at = null;
    } else if (action === "feature") {
      update.featured = true;
    } else if (action === "unfeature") {
      update.featured = false;
    }

    // Keep the displayed status consistent with any deadline change.
    if (fieldPatch.registration_deadline !== undefined && !action) {
      update.registration_status = calculateRegistrationStatus(
        (fieldPatch.registration_deadline as string | null) ?? undefined,
        undefined
      );
    }

    const { error: updateError } = await supabase.from("hackathons").update(update).eq("id", existing.id);
    if (updateError) throw new Error(`Could not update the listing: ${updateError.message}`);

    if (action) {
      const auditAction =
        action === "verify" ? "verify" :
        action === "archive" ? "archive" :
        action === "unarchive" ? "unarchive" :
        action === "feature" ? "feature" : "unfeature";
      await writeHackathonAuditLog(supabase, {
        actorUid: uid,
        action: auditAction,
        hackathonId: existing.id,
        diff: { action, ...(fieldPatch.registration_deadline ? { registration_deadline: fieldPatch.registration_deadline } : {}) },
      });
    }
    if (rawFields !== undefined) {
      await writeHackathonAuditLog(supabase, {
        actorUid: uid,
        action: "update",
        hackathonId: existing.id,
        diff: { fields: Object.keys(fieldPatch) },
      });
    }

    return NextResponse.json({ success: true, id: existing.id, applied: { action: action ?? null, fields: Object.keys(fieldPatch) } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[API:Admin:Hackathons:id] PATCH failed:", message);
    return NextResponse.json({ error: "Could not update the listing." }, { status: 503 });
  }
}
