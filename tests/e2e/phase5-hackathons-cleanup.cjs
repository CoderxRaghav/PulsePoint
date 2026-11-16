/**
 * Ownership-verified cleanup for the Phase 5 E2E suite. Deletes ONLY:
 *  - saved_hackathons rows whose user_id is one of this run's synthetic uids,
 *  - hackathon_suggestions rows tagged to this run (title starts with "E2E Test "),
 *  - hackathons rows whose id starts with "curated-e2etest-<run>-",
 *  - hackathon_audit_log rows whose actor_uid is one of this run's synthetic uids,
 *  - the synthetic Firebase users captured for this run.
 * Aborts WITHOUT deleting anything if any record fails the ownership check.
 * Founder/production rows are never touched.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const RUN = process.env.PHASE5_RUN_ID;
if (!RUN) { console.error('Set PHASE5_RUN_ID to the run id printed by the E2E suite.'); process.exit(1); }
const TAG = `e2etest-${RUN}`;
const STATE_FILE = path.join(os.tmpdir(), `pulsepoint-phase5-e2e-state-${RUN}.json`);
if (!fs.existsSync(STATE_FILE)) { console.error('State file not found: ' + STATE_FILE); process.exit(1); }
const ids = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
const uids = [...new Set(ids.uids)].filter(u => u.startsWith(TAG + '-'));
const hackathonIds = [...new Set(ids.hackathonIds || [])]; // exact ids recorded during the run
console.log('run tag:', TAG);
console.log('synthetic uids:', uids.join(', '));
console.log('synthetic hackathon ids:', hackathonIds.join(', '));
console.log('synthetic suggestion ids:', (ids.suggestionIds || []).join(', '));

const env = {};
for (const raw of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const l = raw.trim();
  if (!l || l.startsWith('#') || !l.includes('=')) continue;
  const i = l.indexOf('=');
  env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
process.env.FIREBASE_ADMIN_PROJECT_ID = env.FIREBASE_ADMIN_PROJECT_ID;
process.env.FIREBASE_ADMIN_CLIENT_EMAIL = env.FIREBASE_ADMIN_CLIENT_EMAIL;
process.env.FIREBASE_ADMIN_PRIVATE_KEY = env.FIREBASE_ADMIN_PRIVATE_KEY;
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const adminAuth = getAuth(initializeApp({ credential: cert({ projectId: env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n') }) }));
const { createClient } = require('@supabase/supabase-js');
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  /* Ownership verification — abort on any mismatch */
  for (const id of hackathonIds) {
    const { data, error } = await db.from('hackathons').select('id, title, submitted_by, apply_url').eq('id', id).maybeSingle();
    if (error || !data) { console.error('ABORT: hackathon lookup failed/missing for', id, error?.message || ''); process.exit(1); }
    const okTitle = String(data.title || '').startsWith('E2E Test ');
    const okSubmitter = uids.includes(data.submitted_by) || String(data.apply_url || '').includes(TAG);
    if (!okTitle || !okSubmitter) { console.error('ABORT: hackathon failed ownership check', JSON.stringify(data)); process.exit(1); }
  }
  const suggestionIds = [...new Set(ids.suggestionIds || [])];
  for (const id of suggestionIds) {
    const { data, error } = await db.from('hackathon_suggestions').select('id, title, submitted_by').eq('id', id).maybeSingle();
    if (error || !data) { console.error('ABORT: suggestion lookup failed/missing for', id, error?.message || ''); process.exit(1); }
    if (!String(data.title || '').startsWith('E2E Test ') || !uids.includes(data.submitted_by)) { console.error('ABORT: suggestion failed ownership check', JSON.stringify(data)); process.exit(1); }
  }
  const founderUid = env.__founderUid;
  if (!founderUid) { console.error('ABORT: __founderUid env var is required for the founder-profile ownership check.'); process.exit(1); }
  const founderProfile = (await db.from('profiles').select('*', { count: 'exact', head: true }).eq('uid', founderUid)).count;
  console.log('founder profile present (must remain untouched):', founderProfile);

  /* Pre-counts */
  const pre = {};
  pre.saved_hackathons = (await db.from('saved_hackathons').select('*', { count: 'exact', head: true }).in('user_id', uids)).count;
  pre.suggestions = suggestionIds.length ? (await db.from('hackathon_suggestions').select('*', { count: 'exact', head: true }).in('id', suggestionIds)).count : 0;
  pre.hackathons = hackathonIds.length ? (await db.from('hackathons').select('*', { count: 'exact', head: true }).in('id', hackathonIds)).count : 0;
  pre.audit_log = (await db.from('hackathon_audit_log').select('*', { count: 'exact', head: true }).in('actor_uid', uids)).count;
  console.log('pre-cleanup counts:', JSON.stringify(pre));

  /* Delete in dependency order: saved rows → suggestions → audit → hackathons */
  const savedDel = await db.from('saved_hackathons').delete().in('user_id', uids);
  console.log('deleted saved_hackathons:', savedDel.error ? 'ERROR ' + savedDel.error.message : 'ok');
  const sugDel = suggestionIds.length ? await db.from('hackathon_suggestions').delete().in('id', suggestionIds) : { error: null };
  console.log('deleted suggestions:', sugDel.error ? 'ERROR ' + sugDel.error.message : 'ok');
  const auditDel = await db.from('hackathon_audit_log').delete().in('actor_uid', uids);
  console.log('deleted audit rows:', auditDel.error ? 'ERROR ' + auditDel.error.message : 'ok');
  const hackDel = hackathonIds.length ? await db.from('hackathons').delete().in('id', hackathonIds) : { error: null };
  console.log('deleted hackathons:', hackDel.error ? 'ERROR ' + hackDel.error.message : 'ok');

  /* Verify zero remain */
  const post = {};
  post.saved_hackathons = (await db.from('saved_hackathons').select('*', { count: 'exact', head: true }).in('user_id', uids)).count;
  post.suggestions = suggestionIds.length ? (await db.from('hackathon_suggestions').select('*', { count: 'exact', head: true }).in('id', suggestionIds)).count : 0;
  post.hackathons = hackathonIds.length ? (await db.from('hackathons').select('*', { count: 'exact', head: true }).in('id', hackathonIds)).count : 0;
  post.audit_log = (await db.from('hackathon_audit_log').select('*', { count: 'exact', head: true }).in('actor_uid', uids)).count;
  console.log('post-cleanup counts (all should be 0):', JSON.stringify(post));
  console.log('founder profile still present (must be 1):', (await db.from('profiles').select('*', { count: 'exact', head: true }).eq('uid', founderUid)).count);

  /* Synthetic Firebase users */
  for (const u of uids) {
    try { await adminAuth.deleteUser(u); console.log('deleted firebase user', u); }
    catch (e) { if (e.code === 'auth/user-not-found') console.log('firebase user already gone', u); else console.error('firebase delete ERROR for', u, e.code || e.message); }
  }
  const remainingAuth = [];
  for (const u of uids) { try { await adminAuth.getUser(u); remainingAuth.push(u); } catch { } }
  console.log('firebase users remaining (should be none):', JSON.stringify(remainingAuth));
})().catch((e) => {
  console.error('FATAL — cleanup incomplete, records may remain isolated under tag ' + TAG, e);
  process.exit(1);
});
