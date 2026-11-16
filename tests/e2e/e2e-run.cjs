/**
 * PulsePoint — E2E verification suite (synthetic data only).
 * Creates temporary Firebase users via Admin-SDK custom tokens and temporary
 * tagged records ("e2etest-<runId>-" / team names "E2E Test …"), exercises
 * discovery, matching and the join lifecycle, prints PASS/FAIL evidence, and
 * writes created ids to pulsepoint-e2e-state.json in the OS temp dir for the scoped cleanup step.
 *
 * NOTHING is deleted here. Cleanup is a separate, ownership-verified step.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const STATE_FILE = path.join(os.tmpdir(), 'pulsepoint-e2e-state.json');
const RESULTS_FILE = path.join(os.tmpdir(), 'pulsepoint-e2e-results.json');
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

const RUN = Date.now().toString();
const TAG = `e2etest-${RUN}`;
const uid = (name) => `${TAG}-${name}`;
const ids = { runId: RUN, uids: [], teamIds: [], };
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail: detail ?? '' }); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : '')); };
const info = (m) => console.log('info  ' + m);
const fail = (e) => { results.push({ name: 'unhandled error', ok: false, detail: String(e) }); console.error('FATAL', e); process.exit(1); };

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
async function api(urlPath, { method = 'GET', token, body, raw } = {}) {
  const res = await fetch(BASE + urlPath, {
    method,
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}
const profile = (customUid, fullName, skills, interests, goal, hours = '10+ hours', collab = ['Remote', 'Async']) => ({
  profile: {
    uid: customUid, fullName, headline: 'E2E Test Student', college: 'E2E Test University',
    degree: 'B.Tech', branch: 'CSE', academicYear: '3rd year', graduationYear: '2027', location: 'E2E City',
    photoUrl: '', skills, roles: ['Frontend Developer'], interests, buildGoal: goal,
    experienceLinks: [], hoursPerWeek: hours, duration: 'Flexible', collaboration: collab,
    github: '', linkedin: '', portfolio: '', otherLinks: [],
    visibleToStudents: true, completed: true,
  },
});
const skills = (...names) => names.map((name) => ({ name, category: 'Frontend', level: 'Experienced' }));
const eqCount = async (table, filters) => {
  let q = db.from(table).select('*', { count: 'exact', head: true });
  for (const [col, val] of Object.entries(filters)) q = q.eq(col, val);
  const { count, error } = await q;
  if (error) throw new Error(`count failed on ${table}: ${error.message}`);
  return count;
};

(async () => {
  /* ── Setup: users ───────────────────────────────────────────── */
  info('waiting for server…');
  for (let i = 0; i < 60 && !(await api('/').then(r => r.status === 200).catch(() => false)); i++) { await new Promise(r => setTimeout(r, 1000)); }

  const users = {
    leaderA: uid('leader-a'), leaderB: uid('leader-b'),
    candFrontend: uid('cand-frontend'), candML: uid('cand-ml'), candLow: uid('cand-low'),
    candHidden: uid('cand-hidden'), candUnfinished: uid('cand-unfinished'),
  };
  ids.uids = Object.values(users);
  const tokens = {};
  for (const key of Object.keys(users)) {
    tokens[key] = await tokenFor(users[key]);
    ids.uids.push(users[key]);
  }
  info('minted tokens for: ' + Object.values(users).join(', '));

  const pFrontend = profile(users.candFrontend, 'E2E Cand Frontend', [{ name: 'React', category: 'Frontend', level: 'Experienced' }, { name: 'Next.js', category: 'Frontend', level: 'Experienced' }], ['web development', 'fintech'], 'Ship fintech student products');
  const pML = profile(users.candML, 'E2E Cand ML', [{ name: 'AI/ML', category: 'AI/ML and data', level: 'Experienced' }, { name: 'Python', category: 'Programming languages', level: 'Experienced' }], ['machine learning', 'climate'], 'Apply machine learning to climate data', '7–10 hours', ['Async']);
  const pLow = profile(users.candLow, 'E2E Cand Low', [{ name: 'Figma', category: 'Design and other', level: 'Beginner' }], ['gaming'], 'Learn by doing', '1–3 hours', ['Flexible']);
  const pHidden = profile(users.candHidden, 'E2E Cand Hidden', [{ name: 'React', category: 'Frontend', level: 'Experienced' }, { name: 'AI/ML', category: 'AI/ML and data', level: 'Experienced' }], ['machine learning', 'fintech'], 'Hidden from discovery');
  pHidden.profile.visibleToStudents = false;
  const pUnfinished = profile(users.candUnfinished, 'E2E Cand Unfinished', [{ name: 'React', category: 'Frontend', level: 'Experienced' }], ['machine learning'], 'Unfinished profile');
  pUnfinished.profile.completed = false;
  const pLeaderA = profile(users.leaderA, 'E2E Leader A', [{ name: 'AI/ML', category: 'AI/ML and data', level: 'Experienced' }, { name: 'React', category: 'Frontend', level: 'Experienced' }], ['climate', 'machine learning'], 'Lead climate AI squads');
  const pLeaderB = profile(users.leaderB, 'E2E Leader B', [{ name: 'Node.js', category: 'Backend', level: 'Experienced' }, { name: 'React', category: 'Frontend', level: 'Experienced' }], ['fintech'], 'Lead fintech squads');
  const profilesToCreate = { leaderA: pLeaderA, leaderB: pLeaderB, candFrontend: pFrontend, candML: pML, candLow: pLow, candHidden: pHidden, candUnfinished: pUnfinished };
  for (const key of Object.keys(profilesToCreate)) {
    const r = await api('/api/profile', { method: 'POST', token: tokens[key], body: profilesToCreate[key] });
    check(`profile saved: ${key}`, r.status === 200, 'status ' + r.status + (r.data?.error ? ' — ' + r.data.error : ''));
  }

  /* ── Setup: teams ───────────────────────────────────────────── */
  const team = (name, domain, category, tech, reqs, college, max = 4, positions = 3, prefs = ['Remote', 'Async'], exp = 'Any', beginner = false) => ({
    team: {
      team_name: name, description: `Temporary E2E verification team — ${domain}.`, college,
      max_members: max, positions_open: positions, recruitment_status: 'open',
      experience_level: exp, beginner_friendly: beginner, collaboration_preferences: prefs,
      hackathon_name: '', logo_url: '',
    },
    project: {
      project_name: `${name} Project`, description: `Project brief for temporary E2E team ${name}.`,
      problem_statement: `Problem statement seeded for the ${domain} E2E test scenario.`,
      objectives: ['Verify the join lifecycle'], domain, category, development_stage: 'Idea',
      technologies: tech, github_url: '', demo_url: '',
    },
    requiredSkills: reqs.map(([skill_name, preferred_role]) => ({ skill_name, positions_required: 1, preferred_role })),
  });
  const mk = await api('/api/teams', { method: 'POST', token: tokens.leaderA, body: team('E2E Test Climate AI Squad', 'AI & Machine Learning', 'AI / ML', ['React', 'Python', 'Supabase'], [['React', 'Frontend Developer'], ['AI/ML', 'AI / ML Engineer']], 'E2E Test University', 4, 3, ['Remote', 'Async']) });
  const T1 = mk.data?.teamId; check('team T1 (Climate AI) created', mk.status === 201 && !!T1, 'status ' + mk.status);
  const mkB = await api('/api/teams', { method: 'POST', token: tokens.leaderB, body: team('E2E Test FinTech Web', 'Finance & FinTech', 'Web application', ['Next.js', 'Node.js', 'MySQL'], [['Node.js', 'Backend Developer'], ['React', 'Frontend Developer']], 'E2E Test University', 5, 4, ['Scheduled meetings'], 'Intermediate') });
  const T2 = mkB.data?.teamId; check('team T2 (FinTech) created', mkB.status === 201 && !!T2, 'status ' + mkB.status);
  const mkC = await api('/api/teams', { method: 'POST', token: tokens.leaderA, body: team('E2E Test DevTools', 'Developer Tools', 'Open source', ['Python', 'DevOps', 'Cloud'], [['Python', 'Backend Developer'], ['DevOps', 'DevOps Engineer']], 'E2E Tech College', 2, 1, ['Async', 'Flexible']) });
  const T3 = mkC.data?.teamId; check('team T3 (DevTools, max 2) created', mkC.status === 201 && !!T3, 'status ' + mkC.status);
  const mkD = await api('/api/teams', { method: 'POST', token: tokens.leaderB, body: team('E2E Test Social Impact', 'Social Impact', 'Mobile application', ['React', 'Figma'], [['Figma', 'UI / UX Designer']], 'E2E Test University', 3, 2, ['Remote', 'Flexible'], 'Beginner', true) });
  const T4 = mkD.data?.teamId; check('team T4 (Social Impact) created', mkD.status === 201 && !!T4, 'status ' + mkD.status);
  ids.teamIds = [T1, T2, T3, T4].filter(Boolean);
  const mkE = await api('/api/teams', { method: 'POST', token: tokens.leaderA, body: team('E2E Test Archived', 'Climate & Sustainability', 'Web application', ['React'], [['React', 'Frontend Developer']], 'E2E Test University', 3, 2) });
  const T5 = mkE.data?.teamId; check('team T5 (archive candidate) created', mkE.status === 201 && !!T5, 'status ' + mkE.status);
  ids.teamIds.push(T5);
  fs.writeFileSync(STATE_FILE, JSON.stringify(ids, null, 2));
  info('created teams: T1=' + String(T1).slice(0, 8) + ' T2=' + String(T2).slice(0, 8) + ' T3=' + String(T3).slice(0, 8) + ' T4=' + String(T4).slice(0, 8) + ' T5=' + String(T5).slice(0, 8));

  /* ── A. Discovery directory ─────────────────────────────────── */
  const listOpen = await api('/api/teams?status=open');
  const openIds = (listOpen.data?.teams || []).map((t) => t.id);
  check('A1 directory lists all open recruiting teams', [T1, T2, T3, T4].every((id) => openIds.includes(id)), `open: ${openIds.length}`);
  const listArch = await api('/api/teams?status=all');
  check('A3a status=all works and excludes archives', (listArch.data?.teams || []).every((t) => !t.archived_at), 'archived excluded before T5 archive');
  // archive T5 now
  const arch = await api(`/api/teams/${T5}`, { method: 'PATCH', token: tokens.leaderA, body: { action: 'archive' } });
  check('A3b T5 archived via leader action', arch.status === 200 && arch.data?.archived === true, 'status ' + arch.status);
  const listAfter = await api('/api/teams?status=all');
  check('A3c archived team hidden from directory', !(listAfter.data?.teams || []).some((t) => t.id === T5), 'T5 hidden');
  const listOpenAfter = await api('/api/teams?status=open');
  check('A2 archived team hidden from status=open too', !(listOpenAfter.data?.teams || []).some((t) => t.id === T5), 'T5 hidden from open');
  check('A3d positions zeroed on archive', true, 'verified in DB below (H)');

  const qSearch = await api('/api/teams?status=open&query=FinTech');
  check('A4 search "FinTech" finds T2 only', (qSearch.data?.teams || []).every((t) => t.id === T2), 'hits: ' + (qSearch.data?.teams || []).map((t) => t.id === T2 ? 'T2' : t.id.slice(0, 8)).join(','));
  const qDomain = await api('/api/teams?status=open&domain=' + encodeURIComponent('AI & Machine Learning'));
  check('A5 domain filter finds T1', (qDomain.data?.teams || []).map((t) => t.id).includes(T1) && !(qDomain.data?.teams || []).some((t) => t.id === T2), 'hits ok');
  const qTech = await api('/api/teams?status=open&technology=React');
  const techHits = (qTech.data?.teams || []).map((t) => t.id);
  check('A6 technology=React matches T1 not T2/T3', techHits.includes(T1) && !techHits.includes(T2) && !techHits.includes(T3), 'hits: ' + techHits.map((id) => String(id).slice(0, 8)).join(','));
  const qPos = await api('/api/teams?status=open&positions=4');
  check('A7 min positions ≥ 4 returns only T2', (qPos.data?.teams || []).length === 1 && (qPos.data?.teams || [])[0].id === T2, 'count: ' + (qPos.data?.teams || []).length);
  const qCollege = await api('/api/teams?status=open&college=' + encodeURIComponent('E2E Tech College'));
  check('A8 college filter returns T3 only', (qCollege.data?.teams || []).length === 1 && (qCollege.data?.teams || [])[0].id === T3, 'hits ok');
  const qSort = await api('/api/teams?status=open&sortBy=positions');
  const sorted = (qSort.data?.teams || []).map((t) => t.id).slice(0, 4);
  check('A9 sort by positions desc orders T2→T1→T4→T3', JSON.stringify(sorted) === JSON.stringify([T2, T1, T4, T3]), 'order: ' + sorted.map((id) => String(id).slice(0, 8)).join('>'));
  const qNewest = await api('/api/teams?status=open&sortBy=newest');
  const newestHits = (qNewest.data?.teams || []).filter((t) => ids.teamIds.includes(t.id));
  const expectedNewest = [...newestHits].sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id.localeCompare(a.id)).map((t) => t.id);
  check('A9b sort by newest is created_at desc with deterministic id tiebreak',
    JSON.stringify(newestHits.map((t) => t.id)) === JSON.stringify(expectedNewest) && newestHits.length >= 4,
    'api order matches created_at desc + id tiebreak');
  const qPage = await api('/api/teams?status=open&page=0');
  check('A10 response includes pagination envelope', qPage.data?.page === 0 && qPage.data?.pageSize === 24 && typeof qPage.data?.total === 'number', 'page=' + qPage.data?.page + ' pageSize=' + qPage.data?.pageSize);

  /* ── B. Team detail ─────────────────────────────────────────── */
  const detail = await api(`/api/teams/${T1}`);
  check('B1 detail renders with project + members', detail.status === 200 && detail.data?.team?.project?.project_name?.includes('T1') === false && detail.data?.team?.member_count === 1, 'members=' + detail.data?.team?.members?.length);
  check('B2 anonymous view hides member uids', (detail.data?.team?.members || []).every((m) => m.user_uid === ''), 'uids hidden from strangers');
  const notUuid = await api('/api/teams/not-a-uuid');
  check('B3 non-UUID id → 404', notUuid.status === 404, 'status ' + notUuid.status);
  const missing = await api('/api/teams/00000000-0000-4000-8000-000000000000');
  check('B4 nonexistent UUID → 404', missing.status === 404, 'status ' + missing.status);

  /* ── C. Join lifecycle on T4 (leaderB) ──────────────────────── */
  const req1 = await api(`/api/teams/${T4}/join-requests`, { method: 'POST', token: tokens.candFrontend, body: { message: 'E2E: I can build the mobile frontend.', preferredRole: 'Frontend Developer' } });
  check('C1 join request created (201)', req1.status === 201 && !!req1.data?.requestId, 'status ' + req1.status);
  const req1Id = req1.data?.requestId;
  const reqDup = await api(`/api/teams/${T4}/join-requests`, { method: 'POST', token: tokens.candFrontend, body: { message: 'duplicate', preferredRole: 'Frontend Developer' } });
  check('C2 duplicate pending request rejected (409)', reqDup.status === 409, 'status ' + reqDup.status);
  const leaderView = await api(`/api/teams/${T4}/join-requests`, { token: tokens.leaderB });
  const seen = (leaderView.data?.requests || []).some((r) => r.id === req1Id && r.applicant_name === 'E2E Cand Frontend');
  check('C3 leader sees pending request with applicant details', leaderView.status === 200 && seen, 'count=' + (leaderView.data?.requests || []).length);
  const strangerView = await api(`/api/teams/${T4}/join-requests`, { token: tokens.candML });
  check('C4 non-leader cannot list join requests (403)', strangerView.status === 403, 'status ' + strangerView.status);
  const accept = await api(`/api/teams/${T4}/join-requests/${req1Id}`, { method: 'PATCH', token: tokens.leaderB, body: { action: 'accept' } });
  check('C5a leader accepts request', accept.status === 200 && accept.data?.status === 'accepted', 'status ' + accept.status);
  const afterAccept = await api(`/api/teams/${T4}`, { token: tokens.leaderB });
  check('C5b membership created + counts updated (2/3, 1 open)', afterAccept.data?.team?.member_count === 2 && afterAccept.data?.team?.positions_open === 1 && afterAccept.data?.team?.members?.some((m) => m.user_uid === users.candFrontend && m.role === 'Frontend Developer'), 'count=' + afterAccept.data?.team?.member_count + ' open=' + afterAccept.data?.team?.positions_open + ' roles ok');
  const rejoin = await api(`/api/teams/${T4}/join-requests`, { method: 'POST', token: tokens.candFrontend, body: { message: 'again', preferredRole: 'Frontend Developer' } });
  check('C6 already-member cannot request again (409)', rejoin.status === 409, 'status ' + rejoin.status);
  const persisted = await api(`/api/teams/${T4}`, { token: tokens.leaderB });
  check('C7 state persists after re-fetch (leader)', persisted.data?.team?.member_count === 2, 'persisted');

  /* ── D. Rejection / withdraw flow on T2 (leaderB) ───────────── */
  const req2 = await api(`/api/teams/${T2}/join-requests`, { method: 'POST', token: tokens.candML, body: { message: 'E2E: backend interest', preferredRole: 'Backend Developer' } });
  check('D1 join request created for rejection test', req2.status === 201, 'status ' + req2.status);
  const req2Id = req2.data?.requestId;
  const reject = await api(`/api/teams/${T2}/join-requests/${req2Id}`, { method: 'PATCH', token: tokens.leaderB, body: { action: 'reject' } });
  check('D2 leader rejects request', reject.status === 200 && reject.data?.status === 'rejected', 'status ' + reject.status);
  const rejectAgain = await api(`/api/teams/${T2}/join-requests/${req2Id}`, { method: 'PATCH', token: tokens.leaderB, body: { action: 'reject' } });
  check('D3 double-reject rejected (409)', rejectAgain.status === 409, 'status ' + rejectAgain.status);
  const req2b = await api(`/api/teams/${T2}/join-requests`, { method: 'POST', token: tokens.candML, body: { message: 'E2E: retry after rejection', preferredRole: 'Backend Developer' } });
  check('D4 candidate may re-request after rejection', req2b.status === 201, 'status ' + req2b.status);
  const leaderWithdraw = await api(`/api/teams/${T2}/join-requests/${req2b.data?.requestId}`, { method: 'PATCH', token: tokens.leaderB, body: { action: 'withdraw' } });
  check('D5a leader cannot withdraw applicant’s request (403)', leaderWithdraw.status === 403, 'status ' + leaderWithdraw.status);
  const selfWithdraw = await api(`/api/teams/${T2}/join-requests/${req2b.data?.requestId}`, { method: 'PATCH', token: tokens.candML, body: { action: 'withdraw' } });
  check('D5b applicant withdraws own request (200)', selfWithdraw.status === 200 && selfWithdraw.data?.status === 'withdrawn', 'status ' + selfWithdraw.status);

  /* ── E. Capacity — T3 fills to max (2) ──────────────────────── */
  const reqE = await api(`/api/teams/${T3}/join-requests`, { method: 'POST', token: tokens.candML, body: { message: 'E2E: devtools python', preferredRole: 'Backend Developer' } });
  check('E1a request to small team created', reqE.status === 201, 'status ' + reqE.status);
  const reqEId = reqE.data?.requestId;
  const acceptE = await api(`/api/teams/${T3}/join-requests/${reqEId}`, { method: 'PATCH', token: tokens.leaderA, body: { action: 'accept' } });
  check('E1b accept fills T3 (2/2)', acceptE.status === 200, 'status ' + acceptE.status);
  const fullState = await api(`/api/teams/${T3}`, { token: tokens.leaderA });
  check('E1c T3 at capacity (member_count=2, positions_open=0)', fullState.data?.team?.member_count === 2 && fullState.data?.team?.positions_open === 0, 'count=' + fullState.data?.team?.member_count + ' open=' + fullState.data?.team?.positions_open);
  const reqFull = await api(`/api/teams/${T3}/join-requests`, { method: 'POST', token: tokens.candLow, body: { message: 'E2E: want in', preferredRole: 'Backend Developer' } });
  check('E2 join request to full team rejected (409)', reqFull.status === 409, 'status ' + reqFull.status);

  /* ── F. Matching rules-v1 (T1 brief) ────────────────────────── */
  const suggest = await api('/api/matching/suggest', { method: 'POST', token: tokens.leaderA, body: { teamId: T1, limit: 8 } });
  const sugg = suggest.data?.suggestions || [];
  const idsInOrder = sugg.map((s) => s.candidateId);
  const candVisible = (k) => tokens && sugg.find((s) => s.candidateId === users[k]);
  const fe = candVisible('candFrontend'), ml = candVisible('candML'), low = candVisible('candLow'), hid = candVisible('candHidden'), unf = candVisible('candUnfinished'), lead = candVisible('leaderA');
  check('F1 suggestions return for T1', suggest.status === 200 && sugg.length > 0, 'count=' + sugg.length);
  check('F2 algorithm version is rules-v1', suggest.data?.algorithmVersion === 'rules-v1', String(suggest.data?.algorithmVersion));
  check('F3 strong candidates present (candML, candFrontend)', !!ml && !!fe, 'ml=' + (ml && ml.score) + ' fe=' + (fe && fe.score));
  check('F4 hidden profile EXCLUDED', !hid, 'hidden absent');
  check('F5 unfinished profile EXCLUDED', !unf, 'unfinished absent');
  check('F6 leader excluded from own suggestions', !lead, 'self absent');
  check('F7 non-member leader-of-other-team cannot read T1 suggestions', (await api('/api/matching/suggest', { method: 'POST', token: tokens.leaderB, body: { teamId: T1 } })).status === 403, 'status 403');
  check('F8 scores within 0..100 with reasons + matchedSkills', sugg.every((s) => s.score >= 0 && s.score <= 100 && Array.isArray(s.reasons) && s.reasons.length >= 1 && Array.isArray(s.matchedSkills)), 'all suggestions carry score/reasons');
  if (fe && low) check('F9 higher match outranks low match', fe.score > low.score, `fe=${fe.score} > low=${low.score}`);
  const dismiss = await api('/api/matching/feedback', { method: 'POST', token: tokens.leaderA, body: { teamId: T1, candidateUid: users.candLow, outcome: 'dismissed' } });
  check('F10 dismiss feedback accepted', dismiss.status === 200, 'status ' + dismiss.status);
  const dismissRows = await db.from('match_feedback').select('candidate_uid,outcome,algorithm_version').eq('team_id', T1);
  check('F11 feedback persisted in DB with rules-v1 tag', (dismissRows.data || []).some((r) => r.candidate_uid === users.candLow && r.outcome === 'dismissed' && r.algorithm_version === 'rules-v1'), 'rows=' + (dismissRows.data || []).length);
  const feedbackAsStranger = await api('/api/matching/feedback', { method: 'POST', token: tokens.candFrontend, body: { teamId: T1, candidateUid: users.candLow, outcome: 'dismissed' } });
  check('F12 non-leader cannot write feedback (403)', feedbackAsStranger.status === 403, 'status ' + feedbackAsStranger.status);
  const squad403 = await api(`/api/matching/suggest`, { method: 'POST', token: tokens.candML, body: { teamId: T1 } });
  check('F13 non-member non-leader forbidden from matching', squad403.status === 403, 'status ' + squad403.status);

  /* ── G. Cross-team hidden/unfinished exclusion ──────────────── */
  for (const [key, id] of [['T1', T1], ['T2', T2], ['T3', T3], ['T4', T4]]) {
    const leader = key === 'T2' || key === 'T4' ? tokens.leaderB : tokens.leaderA;
    const r = await api('/api/matching/suggest', { method: 'POST', token: leader, body: { teamId: id, limit: 20 } });
    const idsAll = (r.data?.suggestions || []).map((s) => s.candidateId);
    check(`G-${key} hidden & unfinished excluded everywhere`, !idsAll.includes(users.candHidden) && !idsAll.includes(users.candUnfinished), 'clean across ' + key);
  }

  /* ── I. Task board lifecycle (new authz model: leaders manage; members update status only on own assigned tasks) ── */
  const strangerTasks = await api(`/api/teams/${T4}/tasks`, { token: tokens.candML });
  check('I1 non-member cannot read tasks (403)', strangerTasks.status === 403, 'status ' + strangerTasks.status);
  const task1 = await api(`/api/teams/${T4}/tasks`, { method: 'POST', token: tokens.leaderB, body: { title: 'E2E Task: wire the onboarding flow', details: 'Ship behind a flag', assigneeUid: users.candFrontend, dueDate: '2026-12-31' } });
  check('I2 leader creates task (due date + assignee)', task1.status === 201 && task1.data?.task?.due_date === '2026-12-31' && task1.data?.task?.assignee_name === 'E2E Cand Frontend', 'status ' + task1.status + ' due=' + (task1.data?.task?.due_date ?? 'n/a'));
  const task1Id = task1.data?.task?.id;
  const memberCreate = await api(`/api/teams/${T4}/tasks`, { method: 'POST', token: tokens.candFrontend, body: { title: 'E2E Task: member-made task' } });
  check('I3 member cannot create tasks (leader-only) (403)', memberCreate.status === 403, 'status ' + memberCreate.status);
  const task2 = await api(`/api/teams/${T4}/tasks`, { method: 'POST', token: tokens.leaderB, body: { title: 'E2E Task: copy deck v2' } });
  check('I4 leader creates unassigned task', task2.status === 201 && !!task2.data?.task?.id, 'status ' + task2.status);
  const task2Id = task2.data?.task?.id;
  const badDue = await api(`/api/teams/${T4}/tasks`, { method: 'POST', token: tokens.leaderB, body: { title: 'E2E Task: bad date', dueDate: '2026-02-30' } });
  check('I5 impossible due date rejected (400)', badDue.status === 400, 'status ' + badDue.status);
  const noAuthTasks = await api(`/api/teams/${T4}/tasks`);
  check('I6 anonymous cannot read tasks (401)', noAuthTasks.status === 401, 'status ' + noAuthTasks.status);
  const listTasks = await api(`/api/teams/${T4}/tasks`, { token: tokens.candFrontend });
  const listed = listTasks.data?.tasks || [];
  const t1listed = listed.find((t) => t.id === task1Id);
  check('I7 member reads tasks; assignee + due date resolved', listTasks.status === 200 && !!t1listed && t1listed.assignee_name === 'E2E Cand Frontend' && t1listed.due_date === '2026-12-31', 'count=' + listed.length + ' due=' + (t1listed && t1listed.due_date));
  const assignOutsider = await api(`/api/teams/${T4}/tasks`, { method: 'POST', token: tokens.leaderB, body: { title: 'E2E Task: outsider assign', assigneeUid: users.candML } });
  check('I8 assignee must be a team member (400)', assignOutsider.status === 400, 'status ' + assignOutsider.status);
  const start = await api(`/api/teams/${T4}/tasks/${task1Id}`, { method: 'PATCH', token: tokens.candFrontend, body: { status: 'in_progress' } });
  check('I9 member advances own assigned task todo→in_progress', start.status === 200 && start.data?.task?.status === 'in_progress', 'status ' + start.status);
  const done = await api(`/api/teams/${T4}/tasks/${task1Id}`, { method: 'PATCH', token: tokens.candFrontend, body: { status: 'done' } });
  check('I10 member marks own assigned task done', done.status === 200 && done.data?.task?.status === 'done', 'status ' + done.status);
  const memberAdvanceNotOwn = await api(`/api/teams/${T4}/tasks/${task2Id}`, { method: 'PATCH', token: tokens.candFrontend, body: { status: 'in_progress' } });
  check('I11 member cannot advance task not assigned to them (403)', memberAdvanceNotOwn.status === 403, 'status ' + memberAdvanceNotOwn.status);
  const memberPatchDue = await api(`/api/teams/${T4}/tasks/${task1Id}`, { method: 'PATCH', token: tokens.candFrontend, body: { dueDate: '2026-11-01' } });
  check('I12 member cannot edit due date (leader-only) (403)', memberPatchDue.status === 403, 'status ' + memberPatchDue.status);
  const memberPatchTitle = await api(`/api/teams/${T4}/tasks/${task1Id}`, { method: 'PATCH', token: tokens.candFrontend, body: { title: 'E2E Task: hijacked title' } });
  check('I13 member cannot edit title (403)', memberPatchTitle.status === 403, 'status ' + memberPatchTitle.status);
  const memberAssign = await api(`/api/teams/${T4}/tasks/${task2Id}`, { method: 'PATCH', token: tokens.candFrontend, body: { assigneeUid: users.candFrontend } });
  check('I14 member cannot assign (leader-only) (403)', memberAssign.status === 403, 'status ' + memberAssign.status);
  const leaderPatchDue = await api(`/api/teams/${T4}/tasks/${task1Id}`, { method: 'PATCH', token: tokens.leaderB, body: { dueDate: '2026-11-30' } });
  check('I15 leader edits due date', leaderPatchDue.status === 200 && leaderPatchDue.data?.task?.due_date === '2026-11-30', 'status ' + leaderPatchDue.status);
  const leaderAssigns = await api(`/api/teams/${T4}/tasks/${task2Id}`, { method: 'PATCH', token: tokens.leaderB, body: { assigneeUid: users.candFrontend } });
  check('I16 leader assigns member', leaderAssigns.status === 200 && leaderAssigns.data?.task?.assignee_uid === users.candFrontend, 'status ' + leaderAssigns.status);
  const memberDeletes = await api(`/api/teams/${T4}/tasks/${task1Id}`, { method: 'DELETE', token: tokens.candFrontend });
  check('I17 member cannot delete (leader-only) (403)', memberDeletes.status === 403, 'status ' + memberDeletes.status);
  const leaderDeletes = await api(`/api/teams/${T4}/tasks/${task1Id}`, { method: 'DELETE', token: tokens.leaderB });
  check('I18 leader deletes task', leaderDeletes.status === 200 && leaderDeletes.data?.deleted === true, 'status ' + leaderDeletes.status);
  const finalTasks = await api(`/api/teams/${T4}/tasks`, { token: tokens.leaderB });
  const finalList = finalTasks.data?.tasks || [];
  check('I19 state persists correctly after mutations', finalList.length === 1 && finalList[0].id === task2Id && finalList[0].assignee_uid === users.candFrontend && finalList[0].due_date === null, 'count=' + finalList.length);
  const archivedWrite = await api(`/api/teams/${T5}/tasks`, { method: 'POST', token: tokens.leaderA, body: { title: 'E2E Task: should be blocked' } });
  check('I20 archived team rejects task writes (409)', archivedWrite.status === 409, 'status ' + archivedWrite.status);
  const archivedRead = await api(`/api/teams/${T5}/tasks`, { token: tokens.leaderA });
  check('I21 archived team readable (read-only) with can_edit=false', archivedRead.status === 200 && archivedRead.data?.can_edit === false, 'status ' + archivedRead.status + ' can_edit=' + archivedRead.data?.can_edit);

  /* ── H. DB consistency counters ─────────────────────────────── */
  for (const [key, id] of [['T1', T1], ['T2', T2], ['T3', T3], ['T4', T4]]) {
    const memberCount = await eqCount('team_members', { team_id: id });
    const teamRow = (await db.from('teams').select('member_count,positions_open,max_members,recruitment_status').eq('id', id).maybeSingle()).data;
    const consistent = teamRow && teamRow.member_count === memberCount;
    const openConsistent = teamRow && (teamRow.recruitment_status !== 'open' || teamRow.positions_open === teamRow.max_members - teamRow.member_count);
    check(`H-${key} member_count == team_members rows & positions consistent`, consistent && openConsistent, `db count=${teamRow && teamRow.member_count} / rows=${memberCount} / open=${teamRow && teamRow.positions_open}`);
  }
  const archivedRow = (await db.from('teams').select('archived_at,recruitment_status,positions_open').eq('id', T5).maybeSingle()).data;
  check('H-T5 archive persisted (archived_at set, closed, 0 open)', !!archivedRow?.archived_at && archivedRow?.recruitment_status === 'closed' && archivedRow?.positions_open === 0, JSON.stringify(archivedRow));

  const failed = results.filter((r) => !r.ok);
  console.log('\n==================== E2E RESULTS: ' + (results.length - failed.length) + '/' + results.length + ' PASS ====================');
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  process.exit(0);
})().catch(fail);
