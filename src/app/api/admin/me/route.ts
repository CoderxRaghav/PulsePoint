import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { getBearerToken } from "@/lib/hackathon-curators";
import { getHackathonCuratorUids, isHackathonCurator } from "@/lib/hackathon-curator-policy";

/**
 * GET /api/admin/me
 * Lightweight identity + curator-role probe for UI gating only. The server
 * still enforces curator authorization on every privileged route.
 */
export async function GET(req: NextRequest) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  try {
    const uid = await verifyFirebaseIdToken(token);
    const curators = getHackathonCuratorUids();
    return NextResponse.json({
      uid,
      isCurator: isHackathonCurator(uid, curators),
      configured: curators.size > 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not configured|credentials are invalid|service account|private key|PEM|parse/i.test(message)) {
      return NextResponse.json({ error: "Authentication is unavailable on this deployment." }, { status: 503 });
    }
    return NextResponse.json({ error: "The Firebase ID token is invalid or expired." }, { status: 401 });
  }
}
