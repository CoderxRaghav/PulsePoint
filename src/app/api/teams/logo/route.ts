import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { authenticatedTeamUid, teamJson } from "@/lib/team-server";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export async function POST(request: NextRequest) {
  let uid: string | null;
  try {
    uid = await authenticatedTeamUid(request);
  } catch (error) {
    console.error("[API:Teams:logo] Firebase authentication configuration failed:", error);
    return teamJson({ error: "Firebase authentication is not configured correctly." }, 500);
  }
  if (!uid) return teamJson({ error: "Authentication required." }, 401);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return teamJson({ error: "A valid image upload is required." }, 400);
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_LOGO_BYTES) {
    return teamJson({ error: "Choose an image smaller than 5 MB." }, 400);
  }
  const extension = allowedTypes.get(file.type);
  if (!extension) {
    return teamJson({ error: "Use a JPG, PNG, WebP, or GIF image." }, 400);
  }

  const path = `${uid}/${randomUUID()}.${extension}`;
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.storage.from("team-logos").upload(path, file, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("team-logos").getPublicUrl(path);
    return teamJson({ logoUrl: data.publicUrl }, 201);
  } catch (error) {
    console.error("[API:Teams:logo] Storage upload failed:", error);
    return teamJson({ error: "The team logo could not be uploaded. Please try again." }, 503);
  }
}
