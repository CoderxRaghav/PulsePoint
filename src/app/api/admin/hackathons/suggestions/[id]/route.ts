import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireHackathonCurator, curatorErrorResponse } from "@/lib/hackathon-curators";
import { validateSuggestion } from "@/lib/hackathon-validation";
import { findDedupMatches, writeHackathonAuditLog } from "@/lib/hackathon-db";
import { calculateRegistrationStatus, generateCanonicalSlug, computeSyncHash } from "@/lib/aggregator/deduplication";

const BODY_LIMIT = 64 * 1024;
const ACTIONS = ["approve", "reject", "edit", "publish"] as const;
type SuggestionAction = (typeof ACTIONS)[number];
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{2,79}$/;

/**
 * PATCH /api/admin/hackathons/suggestions/[id]
 * Curator-only moderation. Actions:
 *   approve  — mark the suggestion as approved (ready to publish)
 *   reject   — reject with optional review_notes
 *   edit     — replace the suggestion's content with validated fields (never publishes)
 *   publish  — create a verified Curated listing from the suggestion, then mark it published
 * Nothing is ever published automatically; every transition is audited.
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
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || !UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Missing or invalid suggestion ID" }, { status: 400 });
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > BODY_LIMIT) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    const raw = await req.json();
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return NextResponse.json({ error: "A JSON object body is required." }, { status: 400 });
    }
    body = raw as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (!ACTIONS.includes(action as SuggestionAction)) {
    return NextResponse.json({ error: `action must be one of: ${ACTIONS.join(", ")}.` }, { status: 400 });
  }
  const reviewNotes =
    typeof body.review_notes === "string" ? body.review_notes.trim().slice(0, 2000) || null : null;

  try {
    const supabase = getSupabaseAdminClient();
    const { data: suggestion, error: loadError } = await supabase
      .from("hackathon_suggestions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (loadError) throw new Error(`Could not load suggestion: ${loadError.message}`);
    if (!suggestion) return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });

    const nowIso = new Date().toISOString();

    if (action === "approve" || action === "reject") {
      if (suggestion.status === "published") {
        return NextResponse.json({ error: "This suggestion was already published." }, { status: 409 });
      }
      const nextStatus = action === "approve" ? "approved" : "rejected";
      const { error: updateError } = await supabase
        .from("hackathon_suggestions")
        .update({
          status: nextStatus,
          reviewer_uid: uid,
          reviewed_at: nowIso,
          review_notes: reviewNotes,
        })
        .eq("id", id)
        .in("status", ["pending", "approved", "rejected"]);
      if (updateError) throw new Error(`Could not update suggestion: ${updateError.message}`);

      await writeHackathonAuditLog(supabase, {
        actorUid: uid,
        action: action === "approve" ? "suggestion_approve" : "suggestion_reject",
        suggestionId: id,
        diff: { from: suggestion.status, to: nextStatus, review_notes: reviewNotes },
      });
      return NextResponse.json({ success: true, status: nextStatus });
    }

    if (action === "edit") {
      if (suggestion.status === "published") {
        return NextResponse.json({ error: "Published suggestions can no longer be edited here." }, { status: 409 });
      }
      const parsed = validateSuggestion(body.fields);
      if (!parsed.ok) {
        return NextResponse.json({ error: "Suggestion is invalid.", details: parsed.errors }, { status: 400 });
      }
      const value = parsed.value;
      const { error: updateError } = await supabase
        .from("hackathon_suggestions")
        .update({
          title: value.title,
          organizer: value.organizer,
          source_url: value.source_url,
          apply_url: value.apply_url,
          mode: value.mode,
          location: value.location,
          registration_deadline: value.registration_deadline,
          start_date: value.start_date,
          end_date: value.end_date,
          prize_pool: value.prize_pool,
          description: value.description,
          eligibility: value.eligibility,
          themes: value.themes,
        })
        .eq("id", id);
      if (updateError) throw new Error(`Could not edit suggestion: ${updateError.message}`);

      await writeHackathonAuditLog(supabase, {
        actorUid: uid,
        action: "suggestion_edit",
        suggestionId: id,
        diff: { fields: Object.keys(value) },
      });
      return NextResponse.json({ success: true });
    }

    // ---- publish ----------------------------------------------------------
    if (suggestion.status === "published") {
      return NextResponse.json({ error: "This suggestion was already published.", hackathonId: suggestion.published_hackathon_id }, { status: 409 });
    }

    const parsed = validateSuggestion({
      title: suggestion.title,
      organizer: suggestion.organizer,
      source_url: suggestion.source_url,
      apply_url: suggestion.apply_url,
      mode: suggestion.mode,
      location: suggestion.location,
      registration_deadline: suggestion.registration_deadline,
      start_date: suggestion.start_date,
      end_date: suggestion.end_date,
      prize_pool: suggestion.prize_pool,
      description: suggestion.description,
      eligibility: suggestion.eligibility,
      themes: suggestion.themes,
    });
    if (!parsed.ok) {
      return NextResponse.json(
        { error: "Stored suggestion is invalid and cannot be published. Edit it first.", details: parsed.errors },
        { status: 400 }
      );
    }
    const value = parsed.value;

    const slugInput = typeof body.slug === "string" ? body.slug.trim() : "";
    const slug = slugInput || generateCanonicalSlug(value.title);
    if (!SLUG_PATTERN.test(slug)) {
      return NextResponse.json({ error: "slug must be 3–80 characters of lowercase letters, numbers and hyphens." }, { status: 400 });
    }

    const confirmDuplicate = body.confirm_duplicate === true;
    const matches = await findDedupMatches(supabase, value.title);
    if (matches.length > 0 && !confirmDuplicate) {
      return NextResponse.json(
        {
          error: "A listing with this event already exists. Confirm to publish anyway, or reject the duplicate.",
          matches,
        },
        { status: 409 }
      );
    }

    const status = calculateRegistrationStatus(value.registration_deadline ?? undefined, "Unknown");
    const hackathonId = `curated-${slug}`;
    const row = {
      id: hackathonId,
      source_event_id: slug,
      slug,
      title: value.title,
      organizer: value.organizer,
      source_platform: "Curated",
      source_url: value.source_url,
      apply_url: value.apply_url,
      banner_url: null,
      mode: value.mode,
      location: value.location,
      registration_status: status,
      registration_deadline: value.registration_deadline,
      start_date: value.start_date,
      end_date: value.end_date,
      prize_pool: value.prize_pool,
      prize_usd: null,
      themes: value.themes,
      skills: [] as string[],
      team_size_min: null,
      team_size_max: null,
      description: value.description,
      eligibility: value.eligibility,
      featured: false,
      verified: true,
      verified_at: nowIso,
      discovered_at: nowIso,
      last_seen_at: nowIso,
      archived_at: null,
      submitted_by: uid,
      curation_notes: reviewNotes ?? suggestion.review_notes ?? `Published from student suggestion ${id}`,
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
          { error: `A curated listing with slug "${slug}" already exists. Pass a different slug.` },
          { status: 409 }
        );
      }
      throw new Error(`Could not create the listing: ${insertError.message}`);
    }

    const { error: markError } = await supabase
      .from("hackathon_suggestions")
      .update({
        status: "published",
        reviewer_uid: uid,
        reviewed_at: nowIso,
        review_notes: reviewNotes ?? suggestion.review_notes,
        published_hackathon_id: hackathonId,
      })
      .eq("id", id);
    if (markError) {
      // The listing exists but the suggestion wasn't marked — surface it so a
      // curator can reconcile instead of double-publishing.
      throw new Error(`Listing created as ${hackathonId}, but the suggestion could not be marked published: ${markError.message}`);
    }

    await writeHackathonAuditLog(supabase, {
      actorUid: uid,
      action: "suggestion_publish",
      hackathonId,
      suggestionId: id,
      diff: { title: value.title, slug, source_url: value.source_url },
    });

    return NextResponse.json({ success: true, hackathonId, slug }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[API:Admin:Suggestions] Moderation failed:", message);
    return NextResponse.json({ error: "Could not complete the moderation action." }, { status: 503 });
  }
}
