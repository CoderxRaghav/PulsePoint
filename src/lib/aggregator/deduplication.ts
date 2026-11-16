import { createHash } from "crypto";
import { NormalizedHackathon, RegistrationStatus } from "./types";

/**
 * Normalizes title into a canonical slug for cross-platform deduplication.
 */
export function generateCanonicalSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Calculates current registration status based on event deadline.
 */
export function calculateRegistrationStatus(
  deadlineIso?: string,
  declaredStatus?: RegistrationStatus
): RegistrationStatus {
  if (!deadlineIso) return declaredStatus || "Unknown";

  const deadline = new Date(deadlineIso).getTime();
  if (isNaN(deadline)) return declaredStatus || "Unknown";

  const now = Date.now();
  const diffHours = (deadline - now) / (1000 * 60 * 60);

  if (diffHours <= 0) {
    return "Closed";
  }
  if (diffHours <= 72) {
    return "Closing Soon";
  }
  return "Open";
}

/**
 * Computes deterministic SHA-256 hash of core content to detect changes.
 */
export function computeSyncHash(event: Partial<NormalizedHackathon>): string {
  const payload = [
    event.title || "",
    event.organizer || "",
    event.mode || "",
    event.registration_status || "",
    event.registration_deadline || "",
    event.start_date || "",
    event.end_date || "",
    event.prize_pool || "",
    event.apply_url || "",
    (event.themes || []).sort().join(","),
  ].join("::");

  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

/**
 * Deduplicates raw events across multiple source platforms.
 * Merges richer descriptions and aggregates themes/skills if duplicate is detected.
 */
export function deduplicateHackathons(
  events: NormalizedHackathon[]
): NormalizedHackathon[] {
  const map = new Map<string, NormalizedHackathon>();

  for (const event of events) {
    const slug = event.slug || generateCanonicalSlug(event.title);
    const existing = map.get(slug);

    if (!existing) {
      map.set(slug, {
        ...event,
        slug,
        registration_status: calculateRegistrationStatus(
          event.registration_deadline,
          event.registration_status
        ),
      });
      continue;
    }

    // Merge: prefer Devfolio/Direct over generic aggregator, combine themes/skills
    const mergedThemes = Array.from(
      new Set([...(existing.themes || []), ...(event.themes || [])])
    );
    const mergedSkills = Array.from(
      new Set([...(existing.skills || []), ...(event.skills || [])])
    );

    const existingDescription = existing.description || "";
    const eventDescription = event.description || "";
    const preferredDescription =
      existingDescription.length >= eventDescription.length
        ? existing.description
        : event.description;

    const preferredBanner = existing.banner_url || event.banner_url;

    map.set(slug, {
      ...existing,
      description: preferredDescription,
      banner_url: preferredBanner,
      themes: mergedThemes,
      skills: mergedSkills,
      registration_status: calculateRegistrationStatus(
        existing.registration_deadline || event.registration_deadline,
        existing.registration_status
      ),
    });
  }

  return Array.from(map.values()).map((evt) => ({
    ...evt,
    sync_hash: computeSyncHash(evt),
  }));
}
