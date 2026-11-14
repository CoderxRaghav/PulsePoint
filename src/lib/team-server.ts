import "server-only";

import { NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";

export const TEAM_BODY_LIMIT = 64 * 1024;

export function teamJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function authenticatedTeamUid(request: Request): Promise<string | null> {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;

  try {
    return await verifyFirebaseIdToken(match[1]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/Firebase Admin is not configured|service account|credential|private key|PEM|parse/i.test(message)) {
      throw new Error("Firebase Admin credentials are invalid or cannot be parsed. Check the FIREBASE_ADMIN_* server environment variables.");
    }
    return null;
  }
}

export async function readTeamJson(request: Request): Promise<{ value?: unknown; response?: NextResponse }> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      return { response: teamJson({ error: "Invalid Content-Length." }, 400) };
    }
    if (Number(contentLength) > TEAM_BODY_LIMIT) {
      return { response: teamJson({ error: "Request body is too large." }, 413) };
    }
  }

  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > TEAM_BODY_LIMIT) {
      return { response: teamJson({ error: "Request body is too large." }, 413) };
    }
    return { value: JSON.parse(text) as unknown };
  } catch {
    return { response: teamJson({ error: "A valid JSON request body is required." }, 400) };
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isBoundedText(value: unknown, minLength: number, maxLength: number): value is string {
  return typeof value === "string" &&
    value.trim().length >= minLength &&
    value.length <= maxLength;
}

export function isTextList(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => isBoundedText(item, 1, maxLength));
}

export function isHttpUrlOrEmpty(value: unknown, maxLength = 2048): value is string {
  if (typeof value !== "string" || value.length > maxLength) return false;
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password;
  } catch {
    return false;
  }
}

export function isTeamLogoUrl(value: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return false;
  try {
    const base = new URL(supabaseUrl);
    const logo = new URL(value);
    return logo.origin === base.origin &&
      logo.pathname.startsWith("/storage/v1/object/public/team-logos/");
  } catch {
    return false;
  }
}

export function teamDatabaseError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";
  if (code === "PGRST205") {
    return {
      error: "Database setup required: The team formation tables have not been created in Supabase yet. Please apply supabase/migrations/20261112000000_create_team_formation.sql in the Supabase SQL editor.",
      status: 503,
    };
  }
  if (code === "23505") return { error: "A matching team or membership already exists.", status: 409 };
  if (code === "23503" || code === "23514" || code === "22023" || code === "22P02") {
    return { error: "The submitted team information is invalid.", status: 400 };
  }
  if (code === "42501") return { error: message || "You are not allowed to perform this action.", status: 403 };
  if (code === "P0002") return { error: message || "The requested team record was not found.", status: 404 };
  if (code === "P0001") return { error: message || "The requested team action is no longer available.", status: 409 };
  return { error: "The team service is temporarily unavailable. Please try again.", status: 503 };
}
