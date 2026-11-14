import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
}

/**
 * GET /api/hackathons/saved
 * Returns array of saved hackathon IDs for the authenticated user.
 */
export async function GET(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const uid = await verifyFirebaseIdToken(token);
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from("saved_hackathons")
      .select("hackathon_id")
      .eq("user_id", uid);

    if (error) {
      throw error;
    }

    const savedIds = (data || []).map((row) => row.hackathon_id);
    return NextResponse.json({ savedIds });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

/**
 * POST /api/hackathons/saved
 * Saves/bookmarks a hackathon for the authenticated user.
 */
export async function POST(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const uid = await verifyFirebaseIdToken(token);
    const body = await req.json().catch(() => ({}));
    const { hackathonId } = body;

    if (!hackathonId || typeof hackathonId !== "string") {
      return NextResponse.json({ error: "Invalid hackathonId" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("saved_hackathons")
      .upsert(
        { user_id: uid, hackathon_id: hackathonId },
        { onConflict: "user_id,hackathon_id" }
      );

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, saved: true, hackathonId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/hackathons/saved
 * Removes a bookmark for the authenticated user.
 */
export async function DELETE(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const uid = await verifyFirebaseIdToken(token);
    const body = await req.json().catch(() => ({}));
    const { hackathonId } = body;

    if (!hackathonId || typeof hackathonId !== "string") {
      return NextResponse.json({ error: "Invalid hackathonId" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("saved_hackathons")
      .delete()
      .match({ user_id: uid, hackathon_id: hackathonId });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, removed: true, hackathonId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
