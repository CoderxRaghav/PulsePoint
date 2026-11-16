/**
 * Input validation for curated hackathons and student suggestions.
 * Pure module — no server-only imports — so it can be unit tested and reused
 * by the suggestion, curation, and seed code paths.
 */

export const HACKATHON_MODES = ["Online", "In Person", "Hybrid"] as const;
export type HackathonModeInput = (typeof HACKATHON_MODES)[number];

export interface NormalizedEventInput {
  slug: string;
  title: string;
  organizer: string | null;
  source_url: string;
  apply_url: string;
  banner_url: string | null;
  mode: HackathonModeInput | null;
  location: string | null;
  registration_deadline: string | null;
  start_date: string | null;
  end_date: string | null;
  prize_pool: string | null;
  prize_usd: number | null;
  themes: string[];
  skills: string[];
  team_size_min: number | null;
  team_size_max: number | null;
  description: string | null;
  eligibility: string | null;
  featured: boolean;
  curation_notes: string | null;
}

export type ValidationResult =
  | { ok: true; value: NormalizedEventInput }
  | { ok: false; errors: string[] };

const MAX_URL = 2048;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalBoundedText(value: unknown, maxLength: number): value is string | null | undefined {
  if (value === null || value === undefined) return true;
  return typeof value === "string" && value.length <= maxLength;
}

function isOptionalIsoDate(value: unknown): value is string | null | undefined {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string") return false;
  const time = Date.parse(value);
  return !Number.isNaN(time);
}

function isOptionalUrl(value: unknown): value is string | null | undefined {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value !== "string" || value.length > MAX_URL) return false;
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

function isRequiredUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > MAX_URL) return false;
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

function isStringList(value: unknown, maxItems: number, maxLength: number): value is string[] {
  if (value === undefined || value === null) return true;
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every(
      (item) => typeof item === "string" && item.trim().length >= 1 && item.length <= maxLength
    )
  );
}

export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/^-+|-+$/g, "");
  return slug;
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, maxLength);
}

function optionalIso(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function optionalUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const trimmed = value.trim();
  return isOptionalUrl(trimmed) ? trimmed : null;
}

function cleanTextList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, maxLength))
        .filter((item) => item.length > 0)
    )
  ).slice(0, maxItems);
}

function optionalInt(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number)) return null;
  if (number < min || number > max) return null;
  return number;
}

/**
 * Validates a curated hackathon payload. Missing optional fields stay null —
 * nothing is invented. Required: title, source_url, apply_url.
 */
export function validateCuratedHackathon(
  input: unknown,
  options: { allowExpired?: boolean } = {}
): ValidationResult {
  if (!isRecord(input)) return { ok: false, errors: ["A JSON object body is required."] };
  const errors: string[] = [];

  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (title.length < 3 || title.length > 160) {
    errors.push("title must be 3–160 characters.");
  }

  if (!isRequiredUrl(input.source_url)) {
    errors.push("source_url must be a valid http(s) URL (the official listing page).");
  }
  if (!isRequiredUrl(input.apply_url)) {
    errors.push("apply_url must be a valid http(s) URL (the official registration link).");
  }
  if (!isOptionalUrl(input.banner_url)) {
    errors.push("banner_url must be a valid http(s) URL when provided.");
  }

  if (input.mode !== undefined && input.mode !== null && !HACKATHON_MODES.includes(input.mode as HackathonModeInput)) {
    errors.push(`mode must be one of: ${HACKATHON_MODES.join(", ")}.`);
  }
  if (!isOptionalBoundedText(input.organizer, 160)) errors.push("organizer must be ≤ 160 characters.");
  if (!isOptionalBoundedText(input.location, 160)) errors.push("location must be ≤ 160 characters.");
  if (!isOptionalBoundedText(input.prize_pool, 200)) errors.push("prize_pool must be ≤ 200 characters.");
  if (!isOptionalBoundedText(input.description, 8000)) errors.push("description must be ≤ 8000 characters.");
  if (!isOptionalBoundedText(input.eligibility, 2000)) errors.push("eligibility must be ≤ 2000 characters.");
  if (!isOptionalBoundedText(input.curation_notes, 2000)) errors.push("curation_notes must be ≤ 2000 characters.");

  if (!isOptionalIsoDate(input.registration_deadline)) errors.push("registration_deadline must be an ISO 8601 date.");
  if (!isOptionalIsoDate(input.start_date)) errors.push("start_date must be an ISO 8601 date.");
  if (!isOptionalIsoDate(input.end_date)) errors.push("end_date must be an ISO 8601 date.");

  const start = optionalIso(input.start_date);
  const end = optionalIso(input.end_date);
  if (start && end && Date.parse(end) < Date.parse(start)) {
    errors.push("end_date cannot be before start_date.");
  }

  const deadline = optionalIso(input.registration_deadline);
  if (deadline && Date.parse(deadline) < Date.now() && !options.allowExpired) {
    errors.push("registration_deadline is in the past. Pass allow_expired: true to publish a historical entry.");
  }

  if (!isStringList(input.themes, 12, 60)) errors.push("themes must be ≤ 12 items, ≤ 60 characters each.");
  if (!isStringList(input.skills, 20, 60)) errors.push("skills must be ≤ 20 items, ≤ 60 characters each.");

  const teamSizeMin = optionalInt(input.team_size_min, 1, 50);
  const teamSizeMax = optionalInt(input.team_size_max, 1, 50);
  if (input.team_size_min !== undefined && input.team_size_min !== null && teamSizeMin === null) {
    errors.push("team_size_min must be an integer between 1 and 50.");
  }
  if (input.team_size_max !== undefined && input.team_size_max !== null && teamSizeMax === null) {
    errors.push("team_size_max must be an integer between 1 and 50.");
  }
  if (teamSizeMin !== null && teamSizeMax !== null && teamSizeMin > teamSizeMax) {
    errors.push("team_size_min cannot exceed team_size_max.");
  }

  if (input.prize_usd !== undefined && input.prize_usd !== null) {
    const prizeUsd = Number(input.prize_usd);
    if (!Number.isFinite(prizeUsd) || prizeUsd < 0) errors.push("prize_usd must be a non-negative number.");
  }

  if (input.featured !== undefined && typeof input.featured !== "boolean") {
    errors.push("featured must be a boolean.");
  }

  if (errors.length > 0) return { ok: false, errors };

  const slug = typeof input.slug === "string" && /^[a-z0-9][a-z0-9-]{2,79}$/.test(input.slug.trim())
    ? input.slug.trim()
    : slugifyTitle(title);
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(slug)) {
    return { ok: false, errors: ["slug must be 3–80 characters of lowercase letters, numbers and hyphens."] };
  }

  const prizeUsd =
    input.prize_usd === undefined || input.prize_usd === null ? null : Math.round(Number(input.prize_usd));

  return {
    ok: true,
    value: {
      slug,
      title,
      organizer: optionalText(input.organizer, 160),
      source_url: (input.source_url as string).trim(),
      apply_url: (input.apply_url as string).trim(),
      banner_url: optionalUrl(input.banner_url),
      mode: (input.mode as HackathonModeInput | undefined | null) ?? null,
      location: optionalText(input.location, 160),
      registration_deadline: deadline,
      start_date: start,
      end_date: end,
      prize_pool: optionalText(input.prize_pool, 200),
      prize_usd: prizeUsd,
      themes: cleanTextList(input.themes, 12, 60),
      skills: cleanTextList(input.skills, 20, 60),
      team_size_min: teamSizeMin,
      team_size_max: teamSizeMax,
      description: optionalText(input.description, 8000),
      eligibility: optionalText(input.eligibility, 2000),
      featured: input.featured === true,
      curation_notes: optionalText(input.curation_notes, 2000),
    },
  };
}

/**
 * Validates a partial update payload (curator edits). Same rules as creation,
 * but only the fields present are checked and returned.
 */
export function validateCuratedPatch(
  input: unknown
): { ok: true; value: Partial<NormalizedEventInput> } | { ok: false; errors: string[] } {
  if (!isRecord(input)) return { ok: false, errors: ["A JSON object body is required."] };
  const errors: string[] = [];
  const patch: Partial<NormalizedEventInput> = {};

  if (input.title !== undefined) {
    if (typeof input.title !== "string" || input.title.trim().length < 3 || input.title.trim().length > 160) {
      errors.push("title must be 3–160 characters.");
    } else {
      patch.title = input.title.trim();
    }
  }
  if (input.organizer !== undefined) {
    if (!isOptionalBoundedText(input.organizer, 160)) errors.push("organizer must be ≤ 160 characters.");
    else patch.organizer = optionalText(input.organizer, 160);
  }
  if (input.source_url !== undefined) {
    if (!isRequiredUrl(input.source_url)) errors.push("source_url must be a valid http(s) URL.");
    else patch.source_url = (input.source_url as string).trim();
  }
  if (input.apply_url !== undefined) {
    if (!isRequiredUrl(input.apply_url)) errors.push("apply_url must be a valid http(s) URL.");
    else patch.apply_url = (input.apply_url as string).trim();
  }
  if (input.banner_url !== undefined) {
    if (!isOptionalUrl(input.banner_url)) errors.push("banner_url must be a valid http(s) URL.");
    else patch.banner_url = optionalUrl(input.banner_url);
  }
  if (input.mode !== undefined) {
    if (input.mode !== null && !HACKATHON_MODES.includes(input.mode as HackathonModeInput)) {
      errors.push(`mode must be one of: ${HACKATHON_MODES.join(", ")}.`);
    } else {
      patch.mode = (input.mode as HackathonModeInput | null) ?? null;
    }
  }
  if (input.location !== undefined) {
    if (!isOptionalBoundedText(input.location, 160)) errors.push("location must be ≤ 160 characters.");
    else patch.location = optionalText(input.location, 160);
  }
  for (const key of ["registration_deadline", "start_date", "end_date"] as const) {
    if (input[key] !== undefined) {
      if (!isOptionalIsoDate(input[key])) errors.push(`${key} must be an ISO 8601 date.`);
      else patch[key] = optionalIso(input[key]);
    }
  }
  if (input.prize_pool !== undefined) {
    if (!isOptionalBoundedText(input.prize_pool, 200)) errors.push("prize_pool must be ≤ 200 characters.");
    else patch.prize_pool = optionalText(input.prize_pool, 200);
  }
  if (input.description !== undefined) {
    if (!isOptionalBoundedText(input.description, 8000)) errors.push("description must be ≤ 8000 characters.");
    else patch.description = optionalText(input.description, 8000);
  }
  if (input.eligibility !== undefined) {
    if (!isOptionalBoundedText(input.eligibility, 2000)) errors.push("eligibility must be ≤ 2000 characters.");
    else patch.eligibility = optionalText(input.eligibility, 2000);
  }
  if (input.curation_notes !== undefined) {
    if (!isOptionalBoundedText(input.curation_notes, 2000)) errors.push("curation_notes must be ≤ 2000 characters.");
    else patch.curation_notes = optionalText(input.curation_notes, 2000);
  }
  if (input.themes !== undefined) {
    if (!isStringList(input.themes, 12, 60)) errors.push("themes must be ≤ 12 items, ≤ 60 characters each.");
    else patch.themes = cleanTextList(input.themes, 12, 60);
  }
  if (input.skills !== undefined) {
    if (!isStringList(input.skills, 20, 60)) errors.push("skills must be ≤ 20 items, ≤ 60 characters each.");
    else patch.skills = cleanTextList(input.skills, 20, 60);
  }
  if (input.team_size_min !== undefined) {
    const v = optionalInt(input.team_size_min, 1, 50);
    if (input.team_size_min !== null && v === null) errors.push("team_size_min must be an integer between 1 and 50.");
    else patch.team_size_min = input.team_size_min === null ? null : v;
  }
  if (input.team_size_max !== undefined) {
    const v = optionalInt(input.team_size_max, 1, 50);
    if (input.team_size_max !== null && v === null) errors.push("team_size_max must be an integer between 1 and 50.");
    else patch.team_size_max = input.team_size_max === null ? null : v;
  }
  if (input.prize_usd !== undefined) {
    if (input.prize_usd === null) {
      patch.prize_usd = null;
    } else {
      const prizeUsd = Number(input.prize_usd);
      if (!Number.isFinite(prizeUsd) || prizeUsd < 0) errors.push("prize_usd must be a non-negative number.");
      else patch.prize_usd = Math.round(prizeUsd);
    }
  }
  if (input.featured !== undefined) {
    if (typeof input.featured !== "boolean") errors.push("featured must be a boolean.");
    else patch.featured = input.featured;
  }

  const mergedMin = patch.team_size_min;
  const mergedMax = patch.team_size_max;
  if (mergedMin != null && mergedMax != null && mergedMin > mergedMax) {
    errors.push("team_size_min cannot exceed team_size_max.");
  }

  if (errors.length > 0) return { ok: false, errors };

  const changedKeys = Object.keys(patch).length;
  if (changedKeys === 0) return { ok: false, errors: ["No updatable fields were provided."] };

  // Slugs are never renamed on edit — they are link identifiers.
  return { ok: true, value: patch };
}

export interface NormalizedSuggestionInput {
  title: string;
  organizer: string | null;
  source_url: string;
  apply_url: string;
  mode: HackathonModeInput | null;
  location: string | null;
  registration_deadline: string | null;
  start_date: string | null;
  end_date: string | null;
  prize_pool: string | null;
  description: string | null;
  eligibility: string | null;
  themes: string[];
}

export type SuggestionValidationResult =
  | { ok: true; value: NormalizedSuggestionInput }
  | { ok: false; errors: string[] };

/**
 * Validates a student-submitted hackathon suggestion. Strict on the two URLs
 * (they are the whole point of the curator's verification job) and bounded on
 * everything else. Suggestions never carry trust fields (verified/featured).
 */
export function validateSuggestion(input: unknown): SuggestionValidationResult {
  if (!isRecord(input)) return { ok: false, errors: ["A JSON object body is required."] };
  const errors: string[] = [];

  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (title.length < 3 || title.length > 160) errors.push("title must be 3–160 characters.");

  if (!isRequiredUrl(input.source_url)) {
    errors.push("source_url must be a valid http(s) URL (the official listing page).");
  }
  if (!isRequiredUrl(input.apply_url)) {
    errors.push("apply_url must be a valid http(s) URL (the official registration link).");
  }
  if (input.mode !== undefined && input.mode !== null && !HACKATHON_MODES.includes(input.mode as HackathonModeInput)) {
    errors.push(`mode must be one of: ${HACKATHON_MODES.join(", ")}.`);
  }
  if (input.location !== undefined && !isOptionalBoundedText(input.location, 160)) {
    errors.push("location must be ≤ 160 characters.");
  }
  if (input.organizer !== undefined && !isOptionalBoundedText(input.organizer, 160)) {
    errors.push("organizer must be ≤ 160 characters.");
  }
  if (input.prize_pool !== undefined && !isOptionalBoundedText(input.prize_pool, 200)) {
    errors.push("prize_pool must be ≤ 200 characters.");
  }
  if (input.description !== undefined && !isOptionalBoundedText(input.description, 4000)) {
    errors.push("description must be ≤ 4000 characters.");
  }
  if (input.eligibility !== undefined && !isOptionalBoundedText(input.eligibility, 2000)) {
    errors.push("eligibility must be ≤ 2000 characters.");
  }
  if (!isOptionalIsoDate(input.registration_deadline)) errors.push("registration_deadline must be an ISO 8601 date.");
  if (!isOptionalIsoDate(input.start_date)) errors.push("start_date must be an ISO 8601 date.");
  if (!isOptionalIsoDate(input.end_date)) errors.push("end_date must be an ISO 8601 date.");
  if (!isStringList(input.themes, 12, 60)) errors.push("themes must be ≤ 12 items, ≤ 60 characters each.");

  const start = optionalIso(input.start_date);
  const end = optionalIso(input.end_date);
  if (start && end && Date.parse(end) < Date.parse(start)) {
    errors.push("end_date cannot be before start_date.");
  }

  // Students may report events that close soon; never silently reject past
  // deadlines here — the curator makes the call at review time.
  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      title,
      organizer: optionalText(input.organizer, 160),
      source_url: (input.source_url as string).trim(),
      apply_url: (input.apply_url as string).trim(),
      mode: (input.mode as HackathonModeInput | undefined | null) ?? null,
      location: optionalText(input.location, 160),
      registration_deadline: optionalIso(input.registration_deadline),
      start_date: start,
      end_date: end,
      prize_pool: optionalText(input.prize_pool, 200),
      description: optionalText(input.description, 4000),
      eligibility: optionalText(input.eligibility, 2000),
      themes: cleanTextList(input.themes, 12, 60),
    },
  };
}
