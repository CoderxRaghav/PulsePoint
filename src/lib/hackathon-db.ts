import "server-only";

import { generateCanonicalSlug } from "@/lib/aggregator/deduplication";

/**
 * Columns that are safe to serve publicly. Never includes submitted_by or
 * curation_notes — those are curator-internal.
 */
export const PUBLIC_HACKATHON_SELECT = [
  "id",
  "slug",
  "title",
  "organizer",
  "source_platform",
  "source_url",
  "apply_url",
  "banner_url",
  "mode",
  "location",
  "registration_status",
  "registration_deadline",
  "start_date",
  "end_date",
  "prize_pool",
  "prize_usd",
  "themes",
  "skills",
  "team_size_min",
  "team_size_max",
  "description",
  "eligibility",
  "featured",
  "verified",
  "verified_at",
  "discovered_at",
  "sync_hash",
  "source_event_id",
  "archived_at",
].join(", ");

export type AuditAction =
  | "create"
  | "update"
  | "verify"
  | "archive"
  | "unarchive"
  | "feature"
  | "unfeature"
  | "suggestion_approve"
  | "suggestion_reject"
  | "suggestion_publish"
  | "suggestion_edit"
  | "archive_expired"
  | "seed";

interface AuditInput {
  actorUid: string;
  action: AuditAction;
  hackathonId?: string | null;
  suggestionId?: string | null;
  diff?: Record<string, unknown>;
}

// The project shares one untyped Supabase client (see src/lib/supabase-admin.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any;

/** Writes a curator audit record. Throws on failure — privileged actions must be auditable. */
export async function writeHackathonAuditLog(supabase: SupabaseLike, input: AuditInput): Promise<void> {
  const { error } = await supabase.from("hackathon_audit_log").insert({
    actor_uid: input.actorUid,
    action: input.action,
    hackathon_id: input.hackathonId ?? null,
    suggestion_id: input.suggestionId ?? null,
    diff: input.diff ?? {},
  });
  if (error) {
    throw new Error(`Could not record the audit log: ${error.message}`);
  }
}

export interface DedupMatch {
  id: string;
  slug: string;
  title: string;
  source_platform: string;
  registration_deadline: string | null;
  archived_at: string | null;
}

/**
 * Finds existing events that share the canonical slug of the given title.
 * Curators use this to avoid duplicate publications; callers decide whether to
 * proceed (never silently overwrite existing rows).
 */
export async function findDedupMatches(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  title: string
): Promise<DedupMatch[]> {
  const slug = generateCanonicalSlug(title);
  const { data, error } = await supabase
    .from("hackathons")
    .select("id, slug, title, source_platform, registration_deadline, archived_at")
    .eq("slug", slug)
    .limit(5);
  if (error) {
    throw new Error(`Could not check for duplicate listings: ${error.message}`);
  }
  return data ?? [];
}
