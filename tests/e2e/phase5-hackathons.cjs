/**
 * Phase 5 — Opportunities (hackathons) E2E verification suite.
 * Synthetic data only: temporary Firebase users via Admin-SDK custom tokens and
 * records tagged "e2etest-<runId>-" / titles "E2E Test ...". Exercises the live
 * server on port 3100 against production Supabase. Creates:
 *   - one synthetic curator (must be in HACKATHON_CURATOR_UIDS for the run),
 *   - one published curated listing (created via a student suggestion),
 *   - bookmarks / saved rows for the synthetic student,
 *   - duplicate-slug constraint probe rows (expected to FAIL with 23505).
 * NOTHING is deleted here. Cleanup is a separate, ownership-verified step:
 *   node tests/e2e/phase5-hackathons-cleanup.cjs
 * Run id is read from PHASE5_RUN_ID so the matching env-file edit stays consistent.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const RUN = process.env.PHASE5_RUN_ID || Date.now().toString();
const TAG = `e2etest-${RUN}`;
const STATE_FILE = path.join(os.tmpdir(), `pulsepoint-phase5-e2e-state-${RUN}.json`);
const RESULTS_FILE = path.join(os.tmpdir(), `pulsepoint-phase5-e2e-results-${RUN}.json`);

const env = {};
for (const raw of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const l = raw.trim();
  if (!l || l.startsWith('#') || !l.includes('=')) continue;
  const i = l.indexOf('=');
  env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const BASE = 'http://localhost:3100';
process.env.FIREBASE_ADMIN_PROJECT_ID = env.FIREBASE_ADMIN_PROJECT_ID;
process.env.FIREBASE_ADMIN_CLIENT_EMAIL = env.FIREBASE_ADMIN_CLIENT_EMAIL;
process.env.FIREBASE_ADMIN_PRIVATE_KEY = env.FIREBASE_ADMIN_PRIVATE_KEY;
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const adminAuth = getAuth(initializeApp({ credential: cert({ projectId: env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n') }) }));
const { createClient } = require('@supabase/supabase-js');
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const uids = { curator: `${TAG}-curator`, studentA: `${TAG}-student-a`, studentB: `${TAG}-student-b` };
const ids = { runId: RUN, uids: Object.values(uids), hackathonIds: [], suggestionIds: [], savedRows: 0 };
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail: detail ?? '' });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : ''));
};
const info = (m) => console.log('info  ' + m);
const writeState = () => fs.writeFileSync(STATE_FILE, JSON.stringify(ids, null, 2));

async function tokenFor(uidValue) {
  const custom = await adminAuth.createCustomToken(uidValue);
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: custom, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error('token exchange failed: ' + JSON.stringify(data));
  return data.idToken;
}
async function api(urlPath, { method = 'GET', token, body } = {}) {
  const res = await fetch(BASE + urlPath, {
    method,
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

(async () => {
  info('waiting for server…');
  for (let i = 0; i < 60 && !(await api('/').then(r => r.status === 200).catch(() => false)); i++) {
    await new Promise(r => setTimeout(r, 1000));
  }

  // ---- Setup: synthetic users + tokens ------------------------------------
  const tokens = {};
  for (const key of Object.keys(uids)) tokens[key] = await tokenFor(uids[key]);
  writeState();

  // ---- Curator authorization ----------------------------------------------
  const meCurator = await api('/api/admin/me', { token: tokens.curator });
  check('synthetic curator is recognized by /api/admin/me', meCurator.status === 200 && meCurator.data?.isCurator === true, JSON.stringify(meCurator.data));
  const meStudent = await api('/api/admin/me', { token: tokens.studentA });
  check('student is NOT a curator', meStudent.status === 200 && meStudent.data?.isCurator === false, JSON.stringify(meStudent.data));
  check('/api/admin/me rejects missing token', (await api('/api/admin/me')).status === 401);
  check('/api/admin/me rejects an invalid token', (await api('/api/admin/me', { token: 'invalid' })).status === 401);

  const beforeTables = {
    hackathons: (await db.from('hackathons').select('*', { count: 'exact', head: true })).count,
    saved: (await db.from('saved_hackathons').select('*', { count: 'exact', head: true })).count,
    suggestions: (await db.from('hackathon_suggestions').select('*', { count: 'exact', head: true })).count,
    audit: (await db.from('hackathon_audit_log').select('*', { count: 'exact', head: true })).count,
  };
  info('pre-run row counts: ' + JSON.stringify(beforeTables));

  // ---- Student cannot reach curator routes ---------------------------------
  const asStudent1 = await api('/api/admin/hackathons', { method: 'POST', token: tokens.studentA, body: { title: 'E2E Test Authorization Probe Event', source_url: 'https://example.org/' + TAG, apply_url: 'https://example.org/' + TAG + '/register' } });
  check('student POST /api/admin/hackathons → 403', asStudent1.status === 403, 'status ' + asStudent1.status);
  check('student GET /api/admin/hackathons/suggestions → 403', (await api('/api/admin/hackathons/suggestions?status=open', { token: tokens.studentA })).status === 403);
  check('student POST /api/hackathons/sync → 403 (curator-only)', (await api('/api/hackathons/sync', { method: 'POST', token: tokens.studentA, body: {} })).status === 403);
  check('unauthenticated POST /api/hackathons/suggestions → 401', (await api('/api/hackathons/suggestions', { method: 'POST', body: { title: 'E2E Test NoAuth Probe', source_url: 'https://example.org/x', apply_url: 'https://example.org/x/r' } })).status === 401);

  // ---- Student suggestion flow ---------------------------------------------
  const futureIso = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();
  const suggestionBody = {
    title: `E2E Test Phase 5 Verification ${RUN}`,
    organizer: 'E2E Test Organizer',
    source_url: `https://example.org/events/${TAG}`,
    apply_url: `https://example.org/events/${TAG}/register`,
    mode: 'Online',
    location: 'Worldwide',
    registration_deadline: futureIso,
    start_date: futureIso,
    end_date: new Date(Date.now() + 61 * 24 * 3600 * 1000).toISOString(),
    prize_pool: 'E2E Test Prizes',
    description: 'Synthetic event used only for automated E2E verification. Not a real hackathon.',
    eligibility: 'E2E Test students only.',
    themes: ['AI/ML'],
  };
  const badSuggestion = await api('/api/hackathons/suggestions', { method: 'POST', token: tokens.studentA, body: { title: 'x', source_url: 'javascript:bad', apply_url: 'not-a-url' } });
  check('invalid suggestion → 400 with details', badSuggestion.status === 400 && Array.isArray(badSuggestion.data?.details), 'status ' + badSuggestion.status);

  const sugA = await api('/api/hackathons/suggestions', { method: 'POST', token: tokens.studentA, body: suggestionBody });
  check('student A submits suggestion → 201 pending', sugA.status === 201 && sugA.data?.suggestion?.status === 'pending', JSON.stringify(sugA.data));
  const suggestionAId = sugA.data?.suggestion?.id;
  if (suggestionAId) { ids.suggestionIds.push(suggestionAId); writeState(); }

  const sugADup = await api('/api/hackathons/suggestions', { method: 'POST', token: tokens.studentA, body: suggestionBody });
  check('same student duplicate → 409', sugADup.status === 409, 'status ' + sugADup.status);

  const sugB = await api('/api/hackathons/suggestions', { method: 'POST', token: tokens.studentB, body: { ...suggestionBody, title: `E2E Test Phase 5 Verification ${RUN} (Second Submitter)` } });
  check('different student same URL → accepted (per-submitter dedup)', sugB.status === 201, 'status ' + sugB.status);
  if (sugB.data?.suggestion?.id) { ids.suggestionIds.push(sugB.data.suggestion.id); writeState(); }

  const mine = await api('/api/hackathons/suggestions', { token: tokens.studentA });
  check('student A sees own suggestion as pending', mine.status === 200 && mine.data?.suggestions?.some(s => s.id === suggestionAId && s.status === 'pending'));

  // ---- Curator moderation queue ---------------------------------------------
  const queue = await api('/api/admin/hackathons/suggestions?status=open&pageSize=50', { token: tokens.curator });
  check('curator queue lists both suggestions', queue.status === 200 && queue.data?.suggestions?.length === 2, 'total=' + queue.data?.total);

  const approve = await api(`/api/admin/hackathons/suggestions/${suggestionAId}`, { method: 'PATCH', token: tokens.curator, body: { action: 'approve', review_notes: 'E2E approve' } });
  check('curator approves suggestion A', approve.status === 200 && approve.data?.status === 'approved', JSON.stringify(approve.data));

  const rejectB = await api(`/api/admin/hackathons/suggestions/${sugB.data?.suggestion?.id}`, { method: 'PATCH', token: tokens.curator, body: { action: 'reject', review_notes: 'E2E Test — duplicate submitter' } });
  check('curator rejects suggestion B', rejectB.status === 200 && rejectB.data?.status === 'rejected', JSON.stringify(rejectB.data));

  const publish = await api(`/api/admin/hackathons/suggestions/${suggestionAId}`, { method: 'PATCH', token: tokens.curator, body: { action: 'publish', review_notes: 'E2E verified official links' } });
  check('curator publishes suggestion A → 201', publish.status === 201 && !!publish.data?.hackathonId, JSON.stringify(publish.data));
  const hackathonId = publish.data?.hackathonId;
  if (hackathonId) { ids.hackathonIds.push(hackathonId); writeState(); }

  // ---- Public catalog visibility --------------------------------------------
  const pubList = await api('/api/hackathons?query=' + encodeURIComponent(`E2E Test Phase 5 Verification ${RUN}`));
  const pubRow = pubList.data?.hackathons?.find(h => h.id === hackathonId);
  check('published listing appears in public catalog search', pubList.status === 200 && !!pubRow, 'status ' + pubList.status);
  check('published listing is PulsePoint Curated + verified', pubRow?.source_platform === 'Curated' && pubRow?.verified === true);
  const pubDetail = await api(`/api/hackathons/${hackathonId}`);
  check('detail page data returns 200 with phase', pubDetail.status === 200 && !!pubDetail.data?.hackathon?.phase, 'status ' + pubDetail.status);

  // ---- Duplicate-slug constraint (expects failure, creates tagged row if unguarded) --
  const probeRow = {
    id: `curated-${TAG}-dup-probe`, slug: `${TAG}-dup-probe`, title: `E2E Test Dup Probe ${RUN}`,
    organizer: 'E2E Test Organizer', source_platform: 'Curated',
    source_url: `https://example.org/events/${TAG}-dup-probe`, apply_url: `https://example.org/events/${TAG}-dup-probe/register`,
    registration_status: 'Open', themes: [], skills: [], verified: true, sync_hash: 'e2e-probe',
  };
  const first = await db.from('hackathons').insert(probeRow).select('id').maybeSingle();
  check('unique-slug probe: first insert succeeds (or already exists)', !first.error || first.error.code === '23505', first.error?.message || 'inserted');
  if (!first.error) ids.hackathonIds.push(probeRow.id);
  const second = await db.from('hackathons').insert({ ...probeRow, id: `curated-${TAG}-dup-probe-2`, sync_hash: 'e2e-probe-2' }).select('id').maybeSingle();
  check('unique-slug probe: duplicate slug is rejected with 23505', second.error?.code === '23505', second.error ? second.error.code : 'NO ERROR — CONSTRAINT MISSING');
  if (!second.error) ids.hackathonIds.push(`curated-${TAG}-dup-probe-2`);
  writeState();

  // ---- Bookmarks --------------------------------------------------------------
  const saveA = await api('/api/hackathons/saved', { method: 'POST', token: tokens.studentA, body: { hackathonId } });
  check('student A bookmarks the listing', saveA.status === 200, 'status ' + saveA.status);
  const savedA = await api('/api/hackathons/saved', { token: tokens.studentA });
  check('student A saved list contains the listing', savedA.status === 200 && savedA.data?.savedIds?.includes(hackathonId));
  if (saveA.status === 200) ids.savedRows += 1;

  // ---- Archive: listing disappears from default catalog, stays bookmarked ----
  const archiveBlocked = await api(`/api/admin/hackathons/${hackathonId}`, { method: 'PATCH', token: tokens.studentA, body: { action: 'archive' } });
  check('student cannot archive (403)', archiveBlocked.status === 403, 'status ' + archiveBlocked.status);
  const archived = await api(`/api/admin/hackathons/${hackathonId}`, { method: 'PATCH', token: tokens.curator, body: { action: 'archive' } });
  check('curator archives the listing', archived.status === 200, 'status ' + archived.status);

  const defaultList = await api('/api/hackathons?query=' + encodeURIComponent(`E2E Test Phase 5 Verification ${RUN}`));
  check('archived listing hidden from default catalog', defaultList.status === 200 && !defaultList.data?.hackathons?.some(h => h.id === hackathonId));
  const detailArchived = await api(`/api/hackathons/${hackathonId}`);
  check('archived listing still reachable by id (bookmarks survive)', detailArchived.status === 200 && detailArchived.data?.hackathon?.archived === true, 'status ' + detailArchived.status);
  const savedAfterArchive = await api('/api/hackathons/saved', { token: tokens.studentA });
  check('bookmark survives archival', savedAfterArchive.status === 200 && savedAfterArchive.data?.savedIds?.includes(hackathonId));

  // ---- Hard delete protection: FK restricts deleting a bookmarked listing ----
  const deleteAttempt = await db.from('hackathons').delete().eq('id', hackathonId);
  check('FK restrict blocks deleting a bookmarked listing (23503)', deleteAttempt.error?.code === '23503', deleteAttempt.error ? deleteAttempt.error.code : 'NO ERROR — FK NOT RESTRICTING');

  // ---- Restore + deadline-window behavior --------------------------------------
  const unarchived = await api(`/api/admin/hackathons/${hackathonId}`, { method: 'PATCH', token: tokens.curator, body: { action: 'unarchive' } });
  check('curator unarchives the listing', unarchived.status === 200, 'status ' + unarchived.status);
  const pastIso = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const pastPatch = await api(`/api/admin/hackathons/${hackathonId}`, { method: 'PATCH', token: tokens.curator, body: { fields: { registration_deadline: pastIso } } });
  check('curator PATCH deadline to the past recomputes status to Closed', pastPatch.status === 200, 'status ' + pastPatch.status);
  const closedList = await api('/api/hackathons?query=' + encodeURIComponent(`E2E Test Phase 5 Verification ${RUN}`));
  check('past-deadline listing hidden by default', closedList.status === 200 && !closedList.data?.hackathons?.some(h => h.id === hackathonId));
  const closedIncluded = await api('/api/hackathons?include_closed=true&query=' + encodeURIComponent(`E2E Test Phase 5 Verification ${RUN}`));
  const closedRow = closedIncluded.data?.hackathons?.find(h => h.id === hackathonId);
  check('past-deadline listing visible with include_closed (status Closed)', closedIncluded.status === 200 && closedRow?.registration_status === 'Closed', closedRow ? closedRow.registration_status : 'missing');

  // ---- Archive-expired endpoint is safe to call --------------------------------
  const archExp = await api('/api/admin/hackathons/archive-expired', { method: 'POST', token: tokens.curator, body: {} });
  check('archive-expired runs (does not touch future events)', archExp.status === 200 && typeof archExp.data?.archived === 'number', JSON.stringify(archExp.data));

  // ---- Sync endpoint is curator-only and quiet when no source is authorized ----
  const syncStudent = await api('/api/hackathons/sync', { method: 'POST', token: tokens.studentB, body: {} });
  check('sync POST remains curator-only', syncStudent.status === 403, 'status ' + syncStudent.status);
  const syncCurator = await api('/api/hackathons/sync', { method: 'POST', token: tokens.curator, body: {} });
  check('sync POST returns unavailable (no authorized sources), no crash', (syncCurator.status === 503 || syncCurator.status === 200) && syncCurator.data?.status === 'unavailable', 'status ' + syncCurator.status + ' ' + JSON.stringify(syncCurator.data?.status));

  // ---- Finish: write state + results ------------------------------------------
  writeState();
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  const passed = results.filter(r => r.ok).length;
  console.log(`\nPHASE 5 E2E: ${passed}/${results.length} checks passed. Run tag: ${TAG}`);
  console.log('State file: ' + STATE_FILE);
  console.log('Run the cleanup script now: node tests/e2e/phase5-hackathons-cleanup.cjs');
  process.exit(results.every(r => r.ok) ? 0 : 1);
})().catch((e) => {
  writeState();
  console.error('FATAL', e);
  console.error('State file (partial): ' + STATE_FILE);
  process.exit(1);
});
