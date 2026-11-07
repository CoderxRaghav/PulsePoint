import { NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function authenticatedUid(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;

  try {
    return await verifyFirebaseIdToken(match[1]);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const uid = await authenticatedUid(request);
  if (!uid) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No image file provided." }, { status: 400 });
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json(
      { error: "Image file is too large. Choose an image smaller than 5 MB." },
      { status: 413 },
    );
  }

  const ext = ALLOWED_MIME_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Unsupported image format. Please upload a JPG, PNG, WebP, or GIF." },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAdminClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const storagePath = `${uid}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-photos")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Supabase Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload image to Supabase Storage. Please retry." },
        { status: 500 },
      );
    }

    const { data: urlData } = supabase.storage
      .from("profile-photos")
      .getPublicUrl(storagePath);

    const photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    return NextResponse.json({ photoUrl });
  } catch (error) {
    console.error("Avatar upload handler error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while saving your avatar." },
      { status: 500 },
    );
  }
}
