#!/usr/bin/env node
/**
 * PulsePoint curated hackathon seed tool.
 *
 * Usage:
 *   node scripts/seed-hackathons.mjs [--file seeds/hackathons.curated.json] [--apply]
 *
 * Defaults to a DRY RUN: validates the curated JSON and prints what it would
 * insert/update. Pass --apply to write through the Supabase service secret
 * (read from SUPABASE_URL / SUPABASE_SECRET_KEY in the environment or .env.local).
 *
 * The script never fabricates fields: every value comes from the JSON file.
 * It never fetches the URLs it stores. Entries with placeholder titles are
 * skipped. Existing rows are updated only when content (sync_hash) changed;
 * nothing is ever deleted — archival is a separate curator action.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(file) {
  try {
    const contents = readFileSync(file, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
      if (!match) continue;
      const value = match[2].replace(/^"|"$/g, "").trim();
      if (process.env[match[1]] === undefined) process.env[match[1]] = value;
    }
  } catch {
    /* no local env file — fall back to process.env */
  }
}
loadEnvFile(path.join(root, ".env.local"));

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const fileIndex = args.indexOf("--file");
const seedFile = path.resolve(root, fileIndex >= 0 ? args[fileIndex + 1] : "seeds/hackathons.curated.json");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set (environment or .env.local).");
  process.exit(1);
}

const MODES = new Set(["Online", "In Person", "Hybrid"]);
const PLACEHOLDER = /^replace\s*me/i;

function isUrl(value) {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      Boolean(parsed.hostname) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim()
    .replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80).replace(/^-+|-+$/g, "");
}

function iso(value) {
  if (value == null) return null;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return undefined; // invalid
  return new Date(time).toISOString();
}

function computedStatus(entry) {
  if (!entry.registration_deadline) return "Unknown";
  const diff = Date.parse(entry.registration_deadline) - Date.now();
  if (diff <= 0) return "Closed";
  if (diff <= 72 * 3600e3) return "Closing Soon";
  return "Open";
}

function computeHash(event) {
  return createHash("sha256")
    .update([
      event.title, event.organizer || "", event.mode || "", computedStatus(event),
      event.registration_deadline || "", event.start_date || "", event.end_date || "",
      event.prize_pool || "", event.apply_url, (event.themes || []).slice().sort().join(","),
    ].join("::"))
    .digest("hex")
    .slice(0, 16);
}

function validateEntry(entry, index) {
  const errors = [];
  const label = entry?.title && typeof entry.title === "string" ? entry.title : `entry #${index + 1}`;

  if (!entry || typeof entry !== "object") return { errors: [`${label}: entry must be an object`] };
  if (typeof entry.title !== "string" || entry.title.trim().length < 3 || entry.title.trim().length > 160) {
    errors.push(`${label}: title must be 3–160 characters`);
  }
  if (typeof entry.apply_url !== "string" || !isUrl(entry.apply_url)) {
    errors.push(`${label}: apply_url must be a valid http(s) official registration link`);
  }
  if (typeof entry.source_url !== "string" || !isUrl(entry.source_url)) {
    errors.push(`${label}: source_url must be a valid http(s) official listing page`);
  }
  if (entry.mode != null && !MODES.has(entry.mode)) errors.push(`${label}: mode must be Online, In Person or Hybrid`);
  for (const key of ["registration_deadline", "start_date", "end_date"]) {
    const converted = iso(entry[key]);
    if (converted === undefined) errors.push(`${label}: ${key} is not a valid ISO date`);
    entry[key] = converted;
  }
  if (entry.registration_deadline && Date.parse(entry.registration_deadline) < Date.now() && !entry.allow_expired) {
    errors.push(`${label}: registration_deadline is in the past (set allow_expired: true to publish it as closed)`);
  }
  if (entry.start_date && entry.end_date && Date.parse(entry.end_date) < Date.parse(entry.start_date)) {
    errors.push(`${label}: end_date is before start_date`);
  }
  if (entry.organizer != null && (typeof entry.organizer !== "string" || entry.organizer.length > 160)) {
    errors.push(`${label}: organizer must be ≤ 160 characters`);
  }
  for (const key of ["themes", "skills"]) {
    if (entry[key] != null && (!Array.isArray(entry[key]) || entry[key].length > 12 ||
        entry[key].some((t) => typeof t !== "string" || !t.trim() || t.length > 60))) {
      errors.push(`${label}: ${key} must be an array of ≤ 12 short strings`);
    }
  }
  for (const key of ["team_size_min", "team_size_max"]) {
    if (entry[key] != null && (!Number.isInteger(entry[key]) || entry[key] < 1 || entry[key] > 50)) {
      errors.push(`${label}: ${key} must be an integer between 1 and 50`);
    }
  }
  if (Number.isInteger(entry.team_size_min) && Number.isInteger(entry.team_size_max) && entry.team_size_min > entry.team_size_max) {
    errors.push(`${label}: team_size_min cannot exceed team_size_max`);
  }
  if (errors.length) return { errors };

  const title = entry.title.trim();
  const slug = typeof entry.slug === "string" && /^[a-z0-9][a-z0-9-]{2,79}$/.test(entry.slug)
    ? entry.slug : slugify(title);

  return {
    errors: [],
    value: {
      id: `curated-${slug}`,
      slug,
      title,
      organizer: entry.organizer?.trim() || null,
      source_platform: "Curated",
      source_url: entry.source_url.trim(),
      apply_url: entry.apply_url.trim(),
      banner_url: entry.banner_url?.trim() || null,
      mode: entry.mode || null,
      location: entry.location?.trim() || null,
      registration_status: computedStatus(entry),
      registration_deadline: entry.registration_deadline,
      start_date: entry.start_date,
      end_date: entry.end_date,
      prize_pool: entry.prize_pool?.trim() || null,
      prize_usd: Number.isFinite(entry.prize_usd) ? Math.round(entry.prize_usd) : null,
      themes: entry.themes ?? [],
      skills: entry.skills ?? [],
      team_size_min: entry.team_size_min ?? null,
      team_size_max: entry.team_size_max ?? null,
      description: entry.description?.trim() || null,
      eligibility: entry.eligibility?.trim() || null,
      featured: entry.featured === true,
      verified: true,
      curation_notes: entry.curation_notes?.trim() || null,
      sync_hash: computeHash(entry),
    },
  };
}

async function rest(servicePath, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${servicePath}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${options.method || "GET"} ${servicePath} → HTTP ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

(async () => {
  let raw;
  try {
    raw = JSON.parse(readFileSync(seedFile, "utf8"));
  } catch (error) {
    console.error(`Could not read seed file ${seedFile}: ${error.message}`);
    process.exit(1);
  }
  if (!Array.isArray(raw?.events)) {
    console.error('Seed file must be { "events": [ ... ] }.');
    process.exit(1);
  }

  const failures = [];
  const rows = [];
  raw.events.forEach((entry, index) => {
    if (PLACEHOLDER.test(entry?.title ?? "")) {
      console.log(`SKIP  placeholder entry #${index + 1} (${entry.title})`);
      return;
    }
    const { errors, value } = validateEntry(entry, index);
    if (errors.length) failures.push(...errors);
    else rows.push(value);
  });

  if (failures.length) {
    console.error("Validation failed — nothing was written:\n" + failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
  if (rows.length === 0) {
    console.log("Seed file contains no publishable events. Nothing to do.");
    return;
  }

  // Compare against existing curated rows to report insert/update/unchanged.
  const ids = rows.map((r) => r.id);
  const existing = await rest(`/hackathons?select=id,sync_hash&id=in.(${ids.map((id) => `"${id}"`).join(",")})`);
  const existingHashes = new Map((existing || []).map((row) => [row.id, row.sync_hash]));

  let inserted = 0, updated = 0, unchanged = 0;
  const nowIso = new Date().toISOString();
  for (const row of rows) {
    const previous = existingHashes.get(row.id);
    if (previous === undefined) inserted += 1;
    else if (previous !== row.sync_hash) updated += 1;
    else unchanged += 1;

    if (apply) {
      const payload = {
        ...row,
        registration_status: computedStatus(row),
        verified_at: nowIso,
        last_seen_at: nowIso,
        archived_at: null,
        submitted_by: "seed-script",
        discovered_at: nowIso,
      };
      delete payload.allow_expired;
      await rest("/hackathons?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(payload),
      });
      await rest("/hackathon_audit_log", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          actor_uid: "seed-script",
          action: "seed",
          hackathon_id: row.id,
          diff: { title: row.title, apply_url: row.apply_url },
        }),
      });
    }
  }

  console.log(`${apply ? "APPLIED" : "DRY RUN"}: ${rows.length} events — ${inserted} new, ${updated} updated, ${unchanged} unchanged.`);
  if (!apply) console.log("Re-run with --apply to write these rows (nothing was changed).");
})().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exit(1);
});
