"use client";

import type { User } from "firebase/auth";

const REQUEST_TIMEOUT_MS = 15_000;

export async function teamRequest<T>(
  user: User | null,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {};
    if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(path, {
      method,
      cache: "no-store",
      signal: controller.signal,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(result.error || "The team service could not complete this request.");
    return result;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("The team service timed out. Please retry.");
    }
    if (error instanceof TypeError) {
      throw new Error("Network request failed. Check your connection and try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function uploadTeamLogo(user: User, file: File) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch("/api/teams/logo", {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      body: (() => {
        const formData = new FormData();
        formData.append("file", file);
        return formData;
      })(),
    });
    const result = await response.json() as { logoUrl?: string; error?: string };
    if (!response.ok || !result.logoUrl) {
      throw new Error(result.error || "Team logo upload failed.");
    }
    return result.logoUrl;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Logo upload timed out. Please retry.");
    if (error instanceof TypeError) throw new Error("Network request failed while uploading the logo.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
