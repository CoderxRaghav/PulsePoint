import { NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { StudentProfile } from "@/lib/profile";

const MAX_BODY_BYTES = 32 * 1024;
const SERVER_OPERATION_TIMEOUT_MS = 10_000;
const profileFields = [
  "uid", "fullName", "headline", "college", "degree", "branch", "academicYear",
  "graduationYear", "location", "photoUrl", "skills", "roles", "interests", "buildGoal",
  "experienceLinks", "hoursPerWeek", "duration", "collaboration", "github", "linkedin",
  "portfolio", "otherLinks", "visibleToStudents", "completed",
] as const;
const skillFields = ["name", "category", "level"] as const;
const skillCategories = ["Programming languages", "Frontend", "Backend", "Databases", "AI/ML and data", "Design and other"];
const skillLevels = ["Beginner", "Comfortable", "Experienced"];
const collaborationOptions = ["Remote", "In person", "Async", "Scheduled meetings", "Flexible"];
const hoursOptions = ["", "1–3 hours", "4–6 hours", "7–10 hours", "10+ hours", "Flexible"];
const academicYearOptions = ["", "1st year", "2nd year", "3rd year", "4th year", "5th year", "Graduate student"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}

class ProfileOperationTimeoutError extends Error {}

function withTimeout<T>(operation: Promise<T>, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  return Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      timeout = setTimeout(() => reject(new ProfileOperationTimeoutError(message)), SERVER_OPERATION_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timeout));
}

function isBoundedString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length <= maxLength;
}

function isHttpUrlOrEmpty(value: unknown, maxLength = 2048) {
  if (typeof value !== "string" || value.length > maxLength) return false;
  if (value === "") return true;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function isStringArray(value: unknown, maxItems: number, maxLength: number) {
  return Array.isArray(value) && value.length <= maxItems && value.every((item) => isBoundedString(item, maxLength));
}

function parseProfile(value: unknown, uid: string): StudentProfile | null {
  if (!isRecord(value) || !hasOnlyKeys(value, profileFields)) return null;
  if (value.uid !== undefined && value.uid !== uid) return null;

  const stringLimits = {
    fullName: 120,
    headline: 160,
    college: 160,
    degree: 120,
    branch: 120,
    academicYear: 32,
    graduationYear: 4,
    location: 120,
    buildGoal: 500,
    hoursPerWeek: 24,
    duration: 120,
    github: 2048,
    linkedin: 2048,
    portfolio: 2048,
  } as const;
  for (const [field, maxLength] of Object.entries(stringLimits)) {
    const fieldValue = value[field];
    if (fieldValue !== undefined && !isBoundedString(fieldValue, maxLength)) return null;
  }

  if (value.graduationYear !== undefined && value.graduationYear !== "" && (typeof value.graduationYear !== "string" || !/^\d{4}$/.test(value.graduationYear))) return null;
  if (value.academicYear !== undefined && !(typeof value.academicYear === "string" && academicYearOptions.includes(value.academicYear))) return null;
  if (value.photoUrl !== undefined && !isHttpUrlOrEmpty(value.photoUrl)) return null;
  if (value.github !== undefined && !isHttpUrlOrEmpty(value.github, 2048)) return null;
  if (value.linkedin !== undefined && !isHttpUrlOrEmpty(value.linkedin, 2048)) return null;
  if (value.portfolio !== undefined && !isHttpUrlOrEmpty(value.portfolio, 2048)) return null;
  if (value.experienceLinks !== undefined && (!Array.isArray(value.experienceLinks) || value.experienceLinks.length > 20 || !value.experienceLinks.every((item) => isHttpUrlOrEmpty(item)))) return null;
  if (value.otherLinks !== undefined && (!Array.isArray(value.otherLinks) || value.otherLinks.length > 20 || !value.otherLinks.every((item) => isHttpUrlOrEmpty(item)))) return null;
  if (value.roles !== undefined && !isStringArray(value.roles, 20, 80)) return null;
  if (value.interests !== undefined && !isStringArray(value.interests, 20, 80)) return null;
  if (value.collaboration !== undefined && (!Array.isArray(value.collaboration) || value.collaboration.length > collaborationOptions.length || !value.collaboration.every((item) => typeof item === "string" && collaborationOptions.includes(item)))) return null;
  if (value.hoursPerWeek !== undefined && !(typeof value.hoursPerWeek === "string" && hoursOptions.includes(value.hoursPerWeek))) return null;
  if (value.visibleToStudents !== undefined && typeof value.visibleToStudents !== "boolean") return null;
  if (value.completed !== undefined && typeof value.completed !== "boolean") return null;

  if (value.skills !== undefined) {
    if (!Array.isArray(value.skills) || value.skills.length > 50) return null;
    for (const skill of value.skills) {
      if (!isRecord(skill) || !hasOnlyKeys(skill, skillFields)) return null;
      if (typeof skill.name !== "string" || skill.name.length > 80 || skill.name.trim() === "") return null;
      if (typeof skill.category !== "string" || !skillCategories.includes(skill.category)) return null;
      if (typeof skill.level !== "string" || !skillLevels.includes(skill.level)) return null;
    }
  }

  return {
    uid,
    fullName: (value.fullName as string | undefined) ?? "",
    headline: (value.headline as string | undefined) ?? "",
    college: (value.college as string | undefined) ?? "",
    degree: (value.degree as string | undefined) ?? "",
    branch: (value.branch as string | undefined) ?? "",
    academicYear: (value.academicYear as string | undefined) ?? "",
    graduationYear: (value.graduationYear as string | undefined) ?? "",
    location: (value.location as string | undefined) ?? "",
    photoUrl: (value.photoUrl as string | undefined) ?? "",
    skills: (value.skills as StudentProfile["skills"] | undefined) ?? [],
    roles: (value.roles as string[] | undefined) ?? [],
    interests: (value.interests as string[] | undefined) ?? [],
    buildGoal: (value.buildGoal as string | undefined) ?? "",
    experienceLinks: (value.experienceLinks as string[] | undefined) ?? [],
    hoursPerWeek: (value.hoursPerWeek as string | undefined) ?? "",
    duration: (value.duration as string | undefined) ?? "",
    collaboration: (value.collaboration as string[] | undefined) ?? [],
    github: (value.github as string | undefined) ?? "",
    linkedin: (value.linkedin as string | undefined) ?? "",
    portfolio: (value.portfolio as string | undefined) ?? "",
    otherLinks: (value.otherLinks as string[] | undefined) ?? [],
    visibleToStudents: (value.visibleToStudents as boolean | undefined) ?? true,
    completed: (value.completed as boolean | undefined) ?? false,
  };
}

async function authenticatedUid(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;

  try {
    return await withTimeout(verifyFirebaseIdToken(match[1]), "Firebase token verification timed out.");
  } catch (error) {
    if (error instanceof ProfileOperationTimeoutError) throw error;
    const message = error instanceof Error ? error.message : "";
    if (/Firebase Admin is not configured|service account|credential|private key|PEM|parse/i.test(message)) {
      throw new Error("Firebase Admin credentials are invalid or cannot be parsed. Check the FIREBASE_ADMIN_* server environment variables.");
    }
    return null;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function authRequired() {
  return jsonResponse({ error: "Authentication required." }, 401);
}

function databaseFailure() {
  return jsonResponse({ code: "profile-service-unavailable", error: "The profile database did not respond in time or is unavailable. Your changes were not confirmed; please retry." }, 503);
}

function authenticationTimeout() {
  return jsonResponse({ code: "firebase-auth-timeout", error: "Firebase took too long to verify your session. Please retry." }, 503);
}

async function getStoredProfile(uid: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("profiles")
    .select("profile")
    .eq("uid", uid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { found: false as const };
  return { found: true as const, profile: parseProfile(data.profile, uid) };
}

async function readJsonBody(request: Request): Promise<{ body?: unknown; error?: NextResponse }> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) return { error: jsonResponse({ error: "Invalid Content-Length." }, 400) };
    if (Number(contentLength) > MAX_BODY_BYTES) return { error: jsonResponse({ error: "Request body is too large." }, 413) };
  }

  if (!request.body) return { error: jsonResponse({ error: "A JSON request body is required." }, 400) };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return { error: jsonResponse({ error: "Request body is too large." }, 413) };
      }
      chunks.push(value);
    }
  } catch {
    return { error: jsonResponse({ error: "Could not read request body." }, 400) };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { body: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown };
  } catch {
    return { error: jsonResponse({ error: "Malformed JSON request body." }, 400) };
  }
}

function profileFromBody(body: unknown, uid: string): StudentProfile | null {
  if (!isRecord(body) || !hasOnlyKeys(body, ["profile"])) return null;
  const profile = parseProfile(body.profile, uid);
  if (!profile) return null;
  if (profile.completed && (
    profile.fullName.trim().length < 2 ||
    !profile.college.trim() ||
    !profile.degree.trim() ||
    !profile.branch.trim() ||
    !profile.academicYear ||
    profile.skills.length === 0 ||
    profile.roles.length === 0 ||
    profile.interests.length === 0 ||
    !profile.buildGoal.trim() ||
    !profile.hoursPerWeek
  )) return null;
  return profile;
}

export async function GET(request: Request) {
  let uid: string | null;
  try {
    uid = await authenticatedUid(request);
  } catch (error) {
    if (error instanceof ProfileOperationTimeoutError) return authenticationTimeout();
    return jsonResponse({ code: "firebase-auth-server-error", error: error instanceof Error ? error.message : "Firebase authentication is not configured correctly." }, 500);
  }
  if (!uid) return authRequired();

  let stored;
  try {
    stored = await getStoredProfile(uid);
  } catch {
    return databaseFailure();
  }
  if (stored.found) {
    if (!stored.profile) return databaseFailure();
    return jsonResponse({ profile: stored.profile });
  }

  return jsonResponse({ profile: null });
}

// POST is create-only: a duplicate UID is a conflict, never a successful save.
export async function POST(request: Request) {
  let uid: string | null;
  try {
    uid = await authenticatedUid(request);
  } catch (error) {
    if (error instanceof ProfileOperationTimeoutError) return authenticationTimeout();
    return jsonResponse({ code: "firebase-auth-server-error", error: error instanceof Error ? error.message : "Firebase authentication is not configured correctly." }, 500);
  }
  if (!uid) return authRequired();
  const parsed = await readJsonBody(request);
  if (parsed.error) return parsed.error;
  const profile = profileFromBody(parsed.body, uid);
  if (!profile) return jsonResponse({ error: "Invalid profile." }, 400);

  try {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("profiles")
      .insert({ uid, profile })
      .select("profile")
      .single();
    if (error?.code === "23505") {
      return jsonResponse({ code: "profile-already-exists", error: "A profile already exists for this Firebase account. Reload it before making changes." }, 409);
    }
    if (error) return databaseFailure();
    const saved = parseProfile(data.profile, uid);
    if (!saved) return databaseFailure();
    return jsonResponse({ profile: saved });
  } catch {
    return databaseFailure();
  }
}

// PUT updates only an existing profile owned by the authenticated Firebase UID.
export async function PUT(request: Request) {
  let uid: string | null;
  try {
    uid = await authenticatedUid(request);
  } catch (error) {
    if (error instanceof ProfileOperationTimeoutError) return authenticationTimeout();
    return jsonResponse({ code: "firebase-auth-server-error", error: error instanceof Error ? error.message : "Firebase authentication is not configured correctly." }, 500);
  }
  if (!uid) return authRequired();
  const parsed = await readJsonBody(request);
  if (parsed.error) return parsed.error;
  const profile = profileFromBody(parsed.body, uid);
  if (!profile) return jsonResponse({ error: "Invalid profile." }, 400);

  try {
    const { data, error } = await getSupabaseAdminClient()
      .from("profiles")
      .update({ profile })
      .eq("uid", uid)
      .select("profile")
      .maybeSingle();
    if (error) return databaseFailure();
    if (!data) {
      return jsonResponse({ code: "profile-not-found", error: "No profile exists to update. Reload profile setup and try again." }, 409);
    }
    const saved = parseProfile(data.profile, uid);
    if (!saved) return databaseFailure();
    return jsonResponse({ profile: saved });
  } catch {
    return databaseFailure();
  }
}
