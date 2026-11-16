// Read-only production verification of the Phase 5 curated seed.
// Performs ONLY HTTP GETs against the Supabase REST endpoint. Writes nothing.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "PulsePoint");
// fallback: script sits in workspace root alongside seeds/; resolve root robustly
const candidates = [process.cwd(), root];
let envPath = null;
for (const c of candidates) {
  try { readFileSync(path.join(c, ".env.local"), "utf8"); envPath = path.join(c, ".env.local"); break; } catch {}
}
function loadEnvFile(file) {
  if (!file) return;
  const contents = readFileSync(file, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (!m) continue;
    const v = m[2].replace(/^"|"$/g, "").trim();
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadEnvFile(envPath);

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !KEY) { console.error("missing env"); process.exit(1); }

async function rest(p) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${p}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${p} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const seed = JSON.parse(readFileSync(path.join(process.cwd(), "seeds", "hackathons.curated.json"), "utf8"));
const expectedSlugs = seed.events.map(e => e.title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80).replace(/^-+|-+$/g, ""));
console.log("Expected slugs:", expectedSlugs.length);

const rows = await rest(`/hackathons?select=id,slug,title,organizer,registration_status,registration_deadline,start_date,end_date,prize_pool,team_size_min,team_size_max,verified,source_platform,featured,archived_at&slug=in.(${expectedSlugs.map(s => `"${s}"`).join(",")})`);
console.log(`Rows found by slug: ${rows.length}`);
for (const r of rows.sort((a, b) => a.slug.localeCompare(b.slug))) {
  console.log(`  ${r.slug} | status=${r.registration_status} | deadline=${r.registration_deadline} | verified=${r.verified} | featured=${r.featured} | archived=${r.archived_at !== null} | prize=${r.prize_pool}`);
}

const pending = await rest(`/hackathons?select=id,title&title=ilike.*${encodeURIComponent("Innodata")}*`);
const pending2 = await rest(`/hackathons?select=id,title&title=ilike.*${encodeURIComponent("Algo Trading")}*`);
const pending3 = await rest(`/hackathons?select=id,title&title=ilike.*${encodeURIComponent("Mantrastra")}*`);
console.log(`Pending-check rows (Innodata/Algo/Mantrastra): ${(pending?.length ?? 0) + (pending2?.length ?? 0) + (pending3?.length ?? 0)} (must be 0)`);

const ids = rows.map(r => r.id);
const audit = await rest(`/hackathon_audit_log?select=action,hackathon_id,actor_uid&action=eq.seed&hackathon_id=in.(${ids.map(i => `"${i}"`).join(",")})`);
console.log(`Seed audit rows for the 12 ids: ${audit?.length ?? 0} (expect 12)`);

const total = await rest(`/hackathons?select=id`);
console.log(`Total hackathons rows in table now: ${total?.length ?? "?"}`);
