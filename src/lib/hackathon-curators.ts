import "server-only";

import { NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { getHackathonCuratorUids } from "@/lib/hackathon-curator-policy";

export class CuratorAuthError extends Error {
  readonly status: 401 | 403 | 503;

  constructor(message: string, status: 401 | 403 | 503) {
    super(message);
    this.name = "CuratorAuthError";
    this.status = status;
  }
}

export function getBearerToken(authorization: string | null): string | null {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

/**
 * Verifies the Firebase ID token from the request and checks the caller's UID
 * against the HACKATHON_CURATOR_UIDS server-side allowlist. Throws
 * CuratorAuthError on failure — routes should map it with curatorErrorResponse.
 */
export async function requireHackathonCurator(request: Request): Promise<string> {
  const token = getBearerToken(request.headers.get("authorization"));
  if (!token) {
    throw new CuratorAuthError("Authentication is required.", 401);
  }

  let uid: string;
  try {
    uid = await verifyFirebaseIdToken(token);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (/not configured|credentials are invalid|service account|private key|PEM|parse/i.test(message)) {
      throw new CuratorAuthError("Curator authentication is unavailable on this deployment.", 503);
    }
    throw new CuratorAuthError("The Firebase ID token is invalid or expired.", 401);
  }

  const curators = getHackathonCuratorUids();
  if (curators.size === 0) {
    throw new CuratorAuthError("Hackathon curation is not configured on this deployment.", 503);
  }
  if (!curators.has(uid)) {
    throw new CuratorAuthError("Curator access is required for this action.", 403);
  }
  return uid;
}

export function curatorErrorResponse(error: unknown): NextResponse {
  // Never swallow Next.js's internal "bail out of prerendering" signal —
  // it must propagate so the route is marked dynamic at request time.
  if (
    error instanceof Error &&
    /bail out of prerendering|prerender/i.test(error.message)
  ) {
    throw error;
  }
  if (error instanceof CuratorAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error("[Hackathons:curator] Unexpected error:", message);
  return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
}
