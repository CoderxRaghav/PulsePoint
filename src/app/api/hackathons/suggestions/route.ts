import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { getBearerToken } from "@/lib/hackathon-curators";
import { validateSuggestion } from "@/lib/hackathon-validation";

const BODY_LIMIT = 32 * 1024;

async function requireUser(req: NextRequest): Promise<{ uid: string } | { error: NextResponse }> {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) {
    return { error: NextResponse.json({ error: "Sign in to suggest a hackathon." }, { status: 401 }) };
  }
  try {
    const uid = await verifyFirebaseIdToken(token);
    return { uid };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not configured|credentials are invalid|service account|private key|PEM|parse/i.test(message)) {
      return {
        error: NextResponse.json({ error: "Authentication is unavailable on this deployment." }, { status: 503 }),
      };
    }
    return { error: NextResponse.json({ error: "The Firebase ID token is invalid or expired." }, { status: 401 }) };
  }
}

/**
 * POST /api/hackathons/suggestions
 * A signed-in student suggests a hackathon. Creates a pending suggestion in a
 * review queue — nothing is published automatically; a curator must review it.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

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

  const parsed = validateSuggestion(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Suggestion is invalid.", details: parsed.errors }, { status: 400 });
  }
  const value = parsed.value;

  try {
    const supabase = getSupabaseAdminClient();

    // Same submitter may not queue the same official registration link twice.
    const { data: existing, error: existingError } = await supabase
      .from("hackathon_suggestions")
      .select("id, status")
      .eq("submitted_by", auth.uid)
      .eq("apply_url", value.apply_url)
      .in("status", ["pending", "approved"])
      .limit(1)
      .maybeSingle();
    if (existingError) {
      throw new Error(`Could not check existing suggestions: ${existingError.message}`);
    }
    if (existing) {
      return NextResponse.json(
        { error: "You already suggested this event and it is awaiting review.", id: existing.id, status: existing.status },
        { status: 409 }
      );
    }

    const { data: inserted, error: insertError } = await supabase
      .from("hackathon_suggestions")
      .insert({
        submitted_by: auth.uid,
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
        status: "pending",
      })
      .select("id, status, created_at")
      .single();
    if (insertError) {
      throw new Error(`Could not save the suggestion: ${insertError.message}`);
    }

    return NextResponse.json({ suggestion: inserted }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[API:Hackathons:suggestions] Failed to create suggestion:", message);
    return NextResponse.json({ error: "Could not submit the suggestion. Please try again." }, { status: 503 });
  }
}

/**
 * GET /api/hackathons/suggestions
 * Returns the caller's own suggestions with moderation status.
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("hackathon_suggestions")
      .select("id, title, organizer, status, created_at, reviewed_at, review_notes, published_hackathon_id")
      .eq("submitted_by", auth.uid)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      throw new Error(`Could not load your suggestions: ${error.message}`);
    }
    return NextResponse.json({ suggestions: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[API:Hackathons:suggestions] Failed to list suggestions:", message);
    return NextResponse.json({ error: "Could not load your suggestions." }, { status: 503 });
  }
}
