/**
 * Ownership-verified cleanup for the E2E run. Deletes ONLY:
 *  - match_feedback rows where team_id ∈ this run's teams,
 *  - teams rows whose id ∈ this run's captured ids AND name starts with "E2E Test ",
 *  - profiles rows whose uid starts with this run's tag,
 *  - the Firebase test users captured in the OS temp state file written by e2e-run.cjs.
 * Aborts WITHOUT deleting anything if any record fails the ownership check.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const STATE_FILE = path.join(os.tmpdir(), 'pulsepoint-e2e-state.json');
const ids = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
const prefix = `e2etest-${ids.runId}-`;
const teamIds = [...new Set(ids.teamIds)].filter(Boolean);
const uids = [...new Set(ids.uids)].filter((u) => u.startsWith(prefix));
console.log('run prefix:', prefix);
console.log('teams to remove:', teamIds.join(', '));
console.log('uids to remove:', uids.join(', '));
if (teamIds.length === 0 || uids.length === 0) { console.error('ABORT: nothing verified to clean'); process.exit(1); }

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
  for (const id of teamIds) {
    const { data, error } = await db.from('teams').select('id,team_name,leader_uid').eq('id', id).maybeSingle();
    if (error || !data) { console.error('ABORT: team lookup failed/missing for', id, error?.message || ''); process.exit(1); }
    if (!data.team_name.startsWith('E2E Test ')) { console.error('ABORT: team name mismatch — refusing to delete', JSON.stringify(data)); process.exit(1); }
  }
  for (const u of uids) {
    const { data, error } = await db.from('profiles').select('uid').eq('uid', u).maybeSingle();
    if (error || !data) { console.error('ABORT: profile lookup failed for', u); process.exit(1); }
    if (!data.uid.startsWith(prefix)) { console.error('ABORT: uid prefix mismatch — refusing to delete', u); process.exit(1); }
  }
  const { count: nonE2ETeams } = await db.from('teams').select('*', { count: 'exact', head: true }).not('team_name', 'like', 'E2E Test %');
  console.log('non-E2E teams present (must remain untouched):', nonE2ETeams);

  /* Pre-counts */
  const pre = {};
  pre.match_feedback = (await db.from('match_feedback').select('*', { count: 'exact', head: true }).in('team_id', teamIds)).count;
  pre.team_join_requests = (await db.from('team_join_requests').select('*', { count: 'exact', head: true }).in('team_id', teamIds)).count;
  pre.team_members = (await db.from('team_members').select('*', { count: 'exact', head: true }).in('team_id', teamIds)).count;
  pre.team_required_skills = (await db.from('team_required_skills').select('*', { count: 'exact', head: true }).in('team_id', teamIds)).count;
  pre.projects = (await db.from('projects').select('*', { count: 'exact', head: true }).in('team_id', teamIds)).count;
  pre.team_tasks = (await db.from('team_tasks').select('*', { count: 'exact', head: true }).in('team_id', teamIds)).count;
  pre.profiles = (await db.from('profiles').select('*', { count: 'exact', head: true }).in('uid', uids)).count;
  pre.teams = (await db.from('teams').select('*', { count: 'exact', head: true }).in('id', teamIds)).count;
  console.log('pre-cleanup counts:', JSON.stringify(pre));

  /* Delete in dependency order */
  const fb = await db.from('match_feedback').delete().in('team_id', teamIds);
  console.log('deleted match_feedback:', fb.error ? 'ERROR ' + fb.error.message : 'ok');
  const teamsDel = await db.from('teams').delete().in('id', teamIds).select('id');
  console.log('deleted teams:', teamsDel.error ? 'ERROR ' + teamsDel.error.message : (teamsDel.data || []).length + ' removed');
  const profilesDel = await db.from('profiles').delete().in('uid', uids).select('uid');
  console.log('deleted profiles:', profilesDel.error ? 'ERROR ' + profilesDel.error.message : (profilesDel.data || []).length + ' removed');

  /* Verify zero remain */
  const post = {};
  post.match_feedback = (await db.from('match_feedback').select('*', { count: 'exact', head: true }).in('team_id', teamIds)).count;
  post.team_join_requests = (await db.from('team_join_requests').select('*', { count: 'exact', head: true }).in('team_id', teamIds)).count;
  post.team_members = (await db.from('team_members').select('*', { count: 'exact', head: true }).in('team_id', teamIds)).count;
  post.team_required_skills = (await db.from('team_required_skills').select('*', { count: 'exact', head: true }).in('team_id', teamIds)).count;
  post.projects = (await db.from('projects').select('*', { count: 'exact', head: true }).in('team_id', teamIds)).count;
  post.team_tasks = (await db.from('team_tasks').select('*', { count: 'exact', head: true }).in('team_id', teamIds)).count;
  post.profiles = (await db.from('profiles').select('*', { count: 'exact', head: true }).in('uid', uids)).count;
  post.teams = (await db.from('teams').select('*', { count: 'exact', head: true }).in('id', teamIds)).count;
  console.log('post-cleanup counts (all should be 0):', JSON.stringify(post));
  console.log('non-E2E teams still present:', (await db.from('teams').select('*', { count: 'exact', head: true }).not('team_name', 'like', 'E2E Test %')).count);

  /* Firebase test users */
  for (const u of uids) {
    try { await adminAuth.deleteUser(u); console.log('deleted firebase user', u); }
    catch (e) { if (e.code === 'auth/user-not-found') console.log('firebase user already gone', u); else console.error('firebase delete ERROR for', u, e.code || e.message); }
  }
  const remainingAuth = [];
  for (const u of uids) { try { await adminAuth.getUser(u); remainingAuth.push(u); } catch { } }
  console.log('firebase users remaining (should be none):', JSON.stringify(remainingAuth));
})().catch((e) => { console.error('FATAL — cleanup incomplete, records may remain isolated under tag ' + prefix, e); process.exit(1); });
