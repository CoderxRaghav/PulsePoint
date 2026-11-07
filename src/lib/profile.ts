import type { User } from "firebase/auth";

export type Skill = { name: string; category: string; level: string };
export type StudentProfile = {
  uid: string;
  fullName: string;
  headline: string;
  college: string;
  degree: string;
  branch: string;
  academicYear: string;
  graduationYear: string;
  location: string;
  photoUrl: string;
  skills: Skill[];
  roles: string[];
  interests: string[];
  buildGoal: string;
  experienceLinks: string[];
  hoursPerWeek: string;
  duration: string;
  collaboration: string[];
  github: string;
  linkedin: string;
  portfolio: string;
  otherLinks: string[];
  visibleToStudents: boolean;
  completed: boolean;
};

export const emptyProfile = (uid: string, fullName = ""): StudentProfile => ({
  uid, fullName, headline: "", college: "", degree: "", branch: "", academicYear: "",
  graduationYear: "", location: "", photoUrl: "", skills: [], roles: [], interests: [],
  buildGoal: "", experienceLinks: [], hoursPerWeek: "", duration: "", collaboration: [],
  github: "", linkedin: "", portfolio: "", otherLinks: [], visibleToStudents: true, completed: false,
});

class ProfileRequestError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

const PROFILE_REQUEST_TIMEOUT_MS = 15_000;
const FIREBASE_TOKEN_TIMEOUT_MS = 10_000;

function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  return Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      timeout = setTimeout(() => reject(new ProfileRequestError(message, "timeout")), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timeout));
}

async function profileRequest(user: User, method: "GET" | "POST" | "PUT", profile?: StudentProfile) {
  const idToken = await withTimeout(
    user.getIdToken(),
    FIREBASE_TOKEN_TIMEOUT_MS,
    "Firebase took too long to confirm your session. Please retry.",
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROFILE_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch("/api/profile", {
      method,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...(profile ? { "Content-Type": "application/json" } : {}),
      },
      ...(profile ? { body: JSON.stringify({ profile }) } : {}),
    });
    let result: { profile?: unknown; error?: string; code?: string } | null;
    try {
      result = await response.json() as { profile?: unknown; error?: string; code?: string };
    } catch {
      if (controller.signal.aborted) {
        throw new ProfileRequestError("The profile request timed out. Your profile was not confirmed as saved; please retry.", "timeout");
      }
      if (response.ok) {
        throw new ProfileRequestError("The profile service returned an invalid response. Please retry.", "invalid-response");
      }
      result = null;
    }
    if (!response.ok) {
      throw new ProfileRequestError(result?.error || "Could not reach the profile service.", result?.code);
    }
    return result?.profile;
  } catch (error) {
    if (error instanceof ProfileRequestError) throw error;
    if (controller.signal.aborted) {
      throw new ProfileRequestError("The profile request timed out. Your profile was not confirmed as saved; please retry.", "timeout");
    }
    if (error instanceof TypeError) {
      throw new ProfileRequestError("Network request failed while contacting the profile service. Check your connection and retry.", "network-error");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isStudentProfile(value: unknown): value is StudentProfile {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function getStudentProfile(user: User): Promise<StudentProfile | null> {
  const serverProfile = await profileRequest(user, "GET");
  if (isStudentProfile(serverProfile) && serverProfile.uid === user.uid) return serverProfile;
  if (serverProfile === null || serverProfile === undefined) return null;
  throw new Error("The profile service returned invalid profile data.");
}

export async function saveStudentProfile(user: User, profile: StudentProfile, createOnly = false) {
  const saved = await profileRequest(user, createOnly ? "POST" : "PUT", { ...profile, uid: user.uid });
  if (!isStudentProfile(saved) || saved.uid !== user.uid) {
    throw new Error("The profile service returned invalid profile data.");
  }
  return saved as StudentProfile;
}

export async function profileDestination(user: User) {
  return (await getStudentProfile(user)) ? "/profile" : "/profile/setup";
}

/**
 * Uploads a profile picture to Supabase Storage via the authenticated avatar API route.
 * Verifies session, validates file type & size, and returns the public CDN URL.
 */
export async function uploadAvatar(user: User, file: File): Promise<string> {
  const idToken = await withTimeout(
    user.getIdToken(),
    FIREBASE_TOKEN_TIMEOUT_MS,
    "Firebase took too long to confirm your session. Please retry.",
  );

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/profile/avatar", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    body: formData,
  });

  let result: { photoUrl?: string; error?: string } | null;
  try {
    result = await response.json() as { photoUrl?: string; error?: string };
  } catch {
    throw new Error("Invalid response from avatar upload service.");
  }

  if (!response.ok || !result?.photoUrl) {
    throw new Error(result?.error || "Failed to upload avatar to Supabase Storage.");
  }

  return result.photoUrl;
}
