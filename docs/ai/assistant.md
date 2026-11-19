# PulsePoint AI Assistant — approved architecture & phased scope

Status: **Phase 7A IMPLEMENTED (2026-11-17), DISABLED BY DEFAULT — NOT founder-verified live.** `AI_ASSISTANT_ENABLED` stays `false` until implementation and local smoke testing pass and the founder authorizes enabling it. **Phase 7B-1 (projects/minimized tasks/own saved hackathons in context) APPROVED 2026-11-18 and implemented the same day — see the Phase 7B-1 section below.** Implemented (7A): authenticated endpoint (`POST`/`GET /api/ai/assistant`), general-knowledge responses via Groq `openai/gpt-oss-20b`, caller-scoped context, minimal UI at `/assistant` plus the floating widget. Implementation notes recorded in this document.

Provider decision: **Groq API (OpenAI-compatible), not Gemini.** Intended initial model: `openai/gpt-oss-20b`. This supersedes the provider portion of the earlier Gemini-era roadmap gate only; the founder-approval gate itself still stands. See `docs/progress-audit.md` for the decision log (the original Gemini note is preserved there as history).

## Product direction (founder-approved)

PulsePoint will build an **All-in-One PulsePoint AI Assistant**. The long-term capability set:

1. **General knowledge questions** — answers to general-knowledge/study questions (e.g., algorithms, web dev, interview prep). Not medical/legal/financial advice; not a substitute for official sources.
2. **Secure, permission-aware retrieval of PulsePoint data** — the assistant answers questions about the caller's own PulsePoint data (their profile, their teams, public catalog listings, etc.) using the same permission rules as the rest of the app.
3. **Project mentoring** — guidance grounded in the caller's projects, teams, and goals (post-7A; see Deferred capabilities).
4. **Real-time external information through separately approved providers** — live data (e.g., event schedules, news, weather) via providers that are **individually approved** before use (see External providers & approval ledger).

## Phased scope

### Phase 7A — first milestone (implemented 2026-11-17; disabled by default; NOT founder-verified live)

- **Authenticated assistant endpoint** (Route Handler). Every request carries a Firebase ID token verified server-side (`verifyFirebaseIdToken` / equivalent), consistent with every other mutation/privileged route (see `AGENTS.md`). Unauthenticated → 401.
- **General knowledge responses** via Groq `openai/gpt-oss-20b`.
- **Basic caller-scoped PulsePoint context** — a compact, server-issued context block describing *the verified caller's own* PulsePoint data (see Security rules for exactly what may be included).
- **Minimal assistant UI** — a single entry point (e.g., a page or panel) that is only usable when the assistant is enabled; includes the privacy disclosure (see Privacy disclosure).
- **No external real-time providers.** No web search, no URL fetching, no Groq built-in tools (browser search, code execution, connectors, remote MCP) are enabled in 7A.
- **No conversation persistence.** No chat history is stored; each request assembles fresh, per-request context. No new tables.
- **No database migrations.**
- **No write operations.** The assistant cannot create, update, or delete anything — no tasks, bookmarks, applications, profile edits, or messages. It is read-only at best and mostly generative.
- **Disabled by default.** Missing/empty server configuration (or an explicit off-flag) means the assistant is off: the endpoint refuses (e.g., 503 "assistant not available") and the UI hides/disables itself. Same safe-default pattern as `HACKATHON_CURATOR_UIDS` (empty = no access).

### Later phases (not approved for implementation yet)

| Phase | Scope | Gate |
|---|---|---|
| 7B | Richer permission-aware PulsePoint retrieval (broader schemas, better grounding, citation of in-app records) | New founder approval; scope written here first |
| 7C | Project mentoring grounded in caller's projects/teams/goals | New founder approval; evaluation plan required |
| 7D | Real-time external information via individually approved providers | Per-provider written approval in the ledger below |
| 7E | Conversation persistence (chat history) | Migration + retention policy + privacy review + founder approval |
| 7F | Write-capable assistant actions (e.g., "create a task") | Separate approval; explicit per-action user confirmation; audit logging |

Each later phase requires its own documented approval before implementation. Phase 7A approval does not imply approval of any later phase.

## Approved architecture (7A)

```
Browser ──(Firebase ID token)──> Next.js Route Handler (server-only)
                                    │ 1. verifyFirebaseIdToken(token) → uid or 401
                                    │ 2. Check assistant enabled (server config) → else 503
                                    │ 3. Assemble compact caller-scoped context (server-side,
                                    │    supabase-admin, rows scoped to verified uid +
                                    │    same visibility rules as the app)
                                    │ 4. POST to Groq Chat Completions API
                                    │    (OpenAI-compatible; GROQ_API_KEY, server-only)
                                    │ 5. Return model text + AI-disclaimer metadata
                                    ▼
                          Groq API (openai/gpt-oss-20b)
```

- **Server-only key.** `GROQ_API_KEY` (proposed name) is a server-only secret, like `SUPABASE_SECRET_KEY` and `FIREBASE_ADMIN_*`. Never `NEXT_PUBLIC_`, never in client bundles, never logged. Keys are managed in the Groq console; limits are organization-level.
- **No provider SDKs required to decide now.** Implementation may use the OpenAI-compatible HTTP API directly or an official SDK, decided at implementation time; either way the key stays server-side.
- **Model.** `openai/gpt-oss-20b`: ~1,000 tok/s, 131,072-token context, 65,536 max completion tokens, knowledge cutoff ~June 2024 (per public listings — verify at implementation). It has **no real-time knowledge**; responses must not present stale knowledge as current fact.
- **Proposed (now added) configuration**: `GROQ_API_KEY` (server-only secret) and an enable flag `AI_ASSISTANT_ENABLED` (default off; any value other than the exact string `true` disables the assistant). Both are documented in `.env.example`; real values live only in `.env.local` / deployment secrets and were never committed or printed.
- **Context budget is small.** Basic caller-scoped context only; the 8K TPM free-tier ceiling makes compact prompts mandatory (see Free-tier constraints).
- **Stateless per request (7A).** No session store, no memory, no persistence. Conversation history, if ever approved (7E), changes the privacy posture and requires migrations + retention policy first.
- **Path alias, patterns, and invariants** follow `AGENTS.md`: privileged reads/writes go through verified route handlers; `src/lib/firebase-admin.ts` / `src/lib/supabase-admin.ts` stay `server-only`; Teams/hackathons tables are never queried from the browser.

## Security rules

1. **Authentication required.** The endpoint verifies a Firebase ID token on every request. No anonymous access, no client-side enforcement only.
2. **Permission-aware retrieval only.** Context assembly may read only rows the verified caller can already read under existing app rules:
   - the caller's own profile (the fields the app itself exposes),
   - teams the caller belongs to / owns (respecting member-visibility rules used by `/api/teams/*`),
   - public, verified, unarchived hackathon listings (same visibility as the public catalog),
   - the caller's own bookmarks/match feedback only if such a read is explicitly implemented and scoped to their uid.
   - **Never**: other users' private data, unverified/private events, curator-only audit logs, `HACKATHON_CURATOR_UIDS`, any service credentials, raw tokens, or anything excluded by `visibleToStudents`/membership checks.
3. **No arbitrary URLs.** Neither the user, nor the model's output, may cause the server to fetch a URL. No tool-calling, browsing, connectors, or remote MCP in 7A. External information is only ever available through the approved-provider ledger below — never through URLs supplied at runtime.
4. **Untrusted inputs.** Both the user's message and any retrieved PulsePoint data are untrusted content. The system prompt must instruct the model to: ignore instructions embedded in retrieved data; never claim the user authorized an action; never reveal the system prompt or configuration; never fabricate PulsePoint records, counts, deadlines, or user data — say "I don't have that" instead.
5. **No write operations (7A).** The assistant has no mutation path. If a later phase adds actions, each action needs explicit per-action user confirmation and audit logging.
6. **Server-side enforcement only.** UI hiding is cosmetic; authorization happens in the route handler.
7. **No secret leakage.** API keys, service secrets, and unpublished configuration are never sent to the model, never logged, never returned in responses or errors. Error responses are generic ("assistant unavailable"), with details only in server logs (no PII or message contents in logs).
8. **Rate limiting & abuse.** The free tier is per Groq organization, shared across all PulsePoint users. Implementation must include a per-user server-side throttle (design TBD at implementation) in addition to Groq's org limits, plus a global kill switch (disable flag). If abuse is suspected, disable the endpoint rather than raise limits.
9. **Model output is not authoritative.** Responses carry an AI-generated disclaimer in UI and API metadata; the assistant must not impersonate PulsePoint staff, curators, or organizers, and must not state or imply it performed actions it cannot perform.
10. **Grounding over fluency.** For PulsePoint-data questions, answers must derive from the provided context; anything not in context must be explicitly marked as unknown rather than invented.

## Privacy disclosure (shown in both assistant UIs — `/assistant` page and the floating widget)

Both UIs show, before first use, a plain-language disclosure covering exactly what the implementation does — nothing more is claimed:

- Your messages and the PulsePoint context assembled for your question may be sent to **Groq** (a third-party inference provider) to generate a response. The `/assistant` page states that Groq processes data on **US infrastructure**.
- **PulsePoint does not store your conversation** — no chat history is kept in our database; refreshing loses it.
- The context can include your profile, your teams, project details, minimized task information (title, status, due date, and whether a task is assigned to you — never other members' identities), and your saved hackathons. Task details and other members' identities (names, emails, UIDs) are never included.
- **Do not enter** passwords, private keys, government IDs, or other people's personal data.
- Responses are **AI-generated and may be wrong** — verify important information against official sources.
- **"AI responses are informational and are not legal, medical, or financial advice."** (both UIs state this).
- Both UIs link the **Privacy notice** (`/legal`).

Deliberate exclusions: the UIs make **no claims about Groq's retention policy, Zero Data Retention (ZDR) status, or training use** — those depend on the organization's Groq console settings and Groq's terms, which the founder must verify before launch and before enabling `AI_ASSISTANT_ENABLED`. Do not add such claims to the UI without verification. If any disclosure changes (provider, persistence in 7E), the UIs and this document must be updated before release.

## Free-tier constraints (Groq, as of November 2026 — verify before implementation)

Source: Groq rate-limit documentation and console (checked November 2026). Limits are **per organization, not per user or per key**; adding keys does not raise them.

| Constraint | `openai/gpt-oss-20b` free tier |
|---|---|
| Requests per minute (RPM) | 30 |
| Requests per day (RPD) | 1,000 |
| Tokens per minute (TPM) | 8,000 |
| Tokens per day (TPD) | 200,000 |

Practical consequences for 7A:

- **8K TPM is the tight limit.** A single long context + long answer can exhaust a minute's budget. Keep the system prompt and caller-scoped context compact; set an explicit, small `max_completion_tokens`.
- **~200 tokens average per request** if the full 200K TPD is to last a day across 1,000 requests. Long conversations (not in 7A) and heavy context directly eat the daily budget.
- **Prompt caching** (gpt-oss models) can extend effective limits; stable system prompts benefit. Cached tokens may not count against limits.
- **429s carry `retry-after`** and `x-ratelimit-*` headers; the implementation must honor them and surface an honest "busy right now, try again shortly" state — never silently retry in a loop.
- **No automatic provider fallback.** If Groq is down or saturated, the assistant degrades to "unavailable" — it must not fail over to another API, scrape, or a different model without a new approval.
- **Free tier is for build/test, not sustained production traffic.** If usage warrants paid tier ($0.075 / 1M input tokens, $0.30 / 1M output, as listed November 2026), that is a separate founder decision.
- **All numbers above are subject to change by Groq.** Re-check https://console.groq.com/docs/rate-limits at implementation time and record actual figures in the implementation notes; do not hard-code limits as assumptions without checking.

## Failure handling

| Failure | Required behavior |
|---|---|
| Assistant disabled / missing config | Endpoint returns a clear "not available" error (e.g., 503); UI entry hidden or disabled. No partial functionality. |
| Invalid/expired/missing token | 401; no context is assembled; nothing is sent to Groq. |
| Context assembly fails | Respond without private context (general knowledge only) **or** return a generic error — never fabricate PulsePoint data; never include raw error internals in the response. |
| Groq 429 (rate/quota) | Honest "busy / daily limit reached, try later" message; honor `retry-after`; no retry storm; do not spend more quota to explain the quota. |
| Groq 5xx / timeout | Bounded server-side timeout (value chosen at implementation, e.g., 15–30s); generic "assistant unavailable" message; log minimal metadata (no contents); no invented fallback answer. |
| Model refusal / safety filter | Show the refusal honestly; do not rephrase to bypass; do not retry with jailbreak-style prompts. |
| Model returns malformed/empty text | Generic failure message; never render raw error bodies or stack traces to the user. |
| User asks for another user's private data | Model instructed to refuse; context never contains it in the first place (defense in depth). |
| User asks for real-time info (scores, news, current events) | Model instructed to state it has no real-time access in 7A and point to official sources; it must not invent current facts. |

Cross-cutting: **fail closed** for anything permission- or safety-relevant; **fail honest** for everything else. Never degrade silently, never substitute unapproved providers, never fabricate.

## External providers & approval ledger (real-time / external data)

Founder approval (2026-11-17) authorizes **Groq as an inference provider for 7A only** — nothing else. No external real-time data provider is approved. Rules, mirroring `docs/hackathons-sources.md`:

1. Every external provider needs **individual, written approval** recorded in this ledger before any integration — covering permitted endpoints/feeds, terms, attribution, rate limits, retention, refresh frequency, date, and scope.
2. **Arbitrary URLs are never fetched** — not from user input, not from model output, not from retrieved data. There is no generic "fetch URL" capability anywhere in the assistant, at any phase.
3. Groq's built-in tools (browser search for GPT-OSS models, code execution, remote MCP, connectors) are **not authorized** by 7A approval and must not be enabled without separate ledger entries.
4. If permission is revoked or unclear, disable the integration. Never substitute scraping or manual records.

| Provider | Access state | Approved scope | Evidence / next step |
|---|---|---|---|
| Groq — `openai/gpt-oss-20b` (inference) | **Authorized (inference only)** — founder, 2026-11-17 | Phase 7A: authenticated general-knowledge Q&A + caller-scoped context responses. No browsing, no tools, no persistence, no fine-tuning, no batch API. | Free tier (30 RPM / 1K RPD / 8K TPM / 200K TPD, org-level). Key server-only. ZDR eligibility noted; org setting is a founder decision at implementation. |
| Any real-time information provider (search, news, weather, live events, etc.) | **Not approved** | — | Each requires its own written approval entry before use. |
| Groq built-in tools (browser search, code execution, connectors, remote MCP) | **Not approved / blocked** | — | Do not enable; separate approval per tool required. |
| Google Gemini | **Not selected** | — | Dropped 2026-11-17 (provider decision: Groq). Historical note preserved in `docs/progress-audit.md`. |

## Deferred / explicitly out of scope (7A)

- Conversation persistence, history, memory across sessions (7E; needs migrations + retention + privacy review).
- Project mentoring grounded in caller data (7C; needs evaluation plan).
- Permission-aware retrieval beyond "basic caller-scoped" (7B).
- Real-time external information (7D; per-provider ledger approval).
- Write actions of any kind (7F).
- Tool-calling/agents, RAG/embeddings/vector stores, multi-model routing, model fine-tuning or LoRA on Groq, batch API.
- Voice, image, file upload, multimodal input.
- Anonymous/public assistant access.
- Any paid provider or paid tier (until a separate founder decision).
- Any claim of "AI-accurate" matching — rules-v1 matching remains a deterministic, transparent heuristic (`docs/ai/matching-v1.md`); the assistant is separate from it.

## Implementation notes (2026-11-17)

Concrete limits chosen at implementation (conservative; consistent with the free-tier ceilings):

- Request body ≤ 32 KB (same as the profile route); ≤ 12 messages; each message ≤ 2,000 chars; ≤ 8,000 chars total across messages; roles limited to `user`/`assistant`; last message must be `user`; unknown top-level keys (e.g. `uid`) rejected with 400.
- `max_completion_tokens: 640`, `temperature: 0.6`, `top_p: 0.95`, `reasoning_effort: "low"`, `include_reasoning: false` (GPT-OSS models do not support `reasoning_format`), non-streaming.
- Provider call timeout 20 s; no retries; `Retry-After` honored and passed through (capped at 300 s); provider 429 → HTTP 429, timeout → 504, 5xx/other → 503, malformed/empty completion → 502. Raw provider errors/bodies are never returned to the client.
- Rate limiting: per-user, in-memory, fixed window of 10 requests / 5 minutes + 30 requests / UTC day (defense against monopolizing the org quota). **Per-process only** — not shared across serverless instances; Groq's org-level limits remain the hard backstop. No message contents are stored; only counters.
- Context: own profile (headline, college/degree/branch/year, skills/roles/interests, build goal, availability, completion) + own teams (name, your role, recruiting status, member count, positions open, hackathon, leader flag). No full names, no links/URLs, no emails, no raw UIDs; profile-photo/GitHub/LinkedIn excluded. Team reads are membership-verified (`team_members.user_uid = verified uid`); profile read is `uid = verified uid`. Context failure degrades to general assistance with `meta.contextUsed = false` — never fabricated.
- Auth order: token verified first (401) → flag/config check (503) → body validation (400/413) → rate limit (429) → context (degrades, never fatal) → Groq (mapped errors). `GET /api/ai/assistant` (authenticated) reports `{ enabled }` only — no provider call, no context.
- `no-store` on all responses. No persistence; client keeps history in memory only (page `/assistant`, "New chat" clears).
- Verified Groq docs 2026-11-17: `openai/gpt-oss-20b` available (production model; ~1,000 tok/s; 131,072-token context; $0.075/$0.30 per 1M tokens); Chat Completions endpoint `https://api.groq.com/openai/v1/chat/completions`.
- Not verified live in this phase: any real Groq call, any authenticated browser session, or enabling the flag. `AI_ASSISTANT_ENABLED` remains `false` in `.env.local`.
- Homepage floating assistant widget (2026-11-17): floating robot "Ask AI" button bottom-right of `/` (`src/components/assistant/assistant-widget.tsx`) opens a compact chat panel reusing `POST /api/ai/assistant` (same Firebase ID-token flow, same validation/rate limits, no new backend). Same privacy disclosure; "Online" indicator shown only when the assistant is actually enabled; otherwise an honest "Assistant unavailable" / sign-in-required state. Header/navbar "AI Assistance" anchor removed (footer link to the AI preview retained, as is the preview itself); `/assistant` standalone route unchanged. New devDependencies for widget tests: `jsdom`, `@testing-library/react`, `@testing-library/dom` (component tests were not previously possible — suite had no DOM environment).

## Implementation checklist (completed 2026-11-17 — kept for reference)

1. ✅ Add `GROQ_API_KEY` (+ enable flag) to `.env.example` and deployment env; keep server-only; never print values.
2. ✅ Route handler with token verification, enable-check, compact context assembly (uid-scoped), Groq call with bounded timeout, generic error mapping, minimal logging. (`src/app/api/ai/assistant/route.ts`)
3. ✅ Per-user throttle; org-quota awareness; `Retry-After` handling; kill switch. (`src/lib/ai/rate-limit.ts` — per-process, see Implementation notes.)
4. ✅ Minimal UI with the privacy disclosure above; hidden/disabled when assistant is off. (`src/app/assistant/page.tsx`, `src/components/assistant/assistant-chat.tsx`)
5. ✅ Tests: auth gates (401), disabled-default behavior, context scoping (no cross-user rows), failure-mode mapping (429/5xx/timeout/malformed) with mocked Groq responses. (`tests/ai/assistant.test.ts`)
6. ✅ Doc status updates (this file + `docs/progress-audit.md`). ⬜ Re-check Groq free-tier numbers and terms at launch; ⬜ founder verification before enabling `AI_ASSISTANT_ENABLED`.

## Phase 7B-1 — PulsePoint-aware retrieval (approved 2026-11-18; implemented 2026-11-18)

**Founder approval (2026-11-18) covers exactly this scope — nothing more:**
1. Projects belonging to teams the authenticated user is a **verified member** of.
2. **Minimized tasks** belonging to those teams.
3. The authenticated user's **own saved hackathons**.
4. Sending this minimized context to Groq (same Groq-as-inference-provider approval as 7A).
5. Privacy disclosure updated in both chatbot UIs (`/assistant` page and the floating widget).

Still **not** authorized: other members' identities/profiles of any kind, cross-user data, curator data, unbookmarked catalog listings, public-catalog Q&A, real-time/live information (7D), mentoring beyond context grounding (7C), conversation persistence (7E), any write/action capability (7F).

**Data categories and minimized fields (as implemented in `src/lib/ai/context.ts`):**
- Projects (member teams only): team name, project name (≤60), description (≤120), domain/category/development stage (≤40 each), technologies (≤8 × ≤30 chars), objectives (≤4 × ≤40 chars). `github_url`/`demo_url` and `problem_statement` are **never selected**.
- Tasks (member teams only, at most 3 teams with task detail): each eligible team is fetched with its **own bounded queries** — ≤5 open `todo`/`in_progress` + ≤5 `done`, both ordered by `updated_at` desc (`updated_at` is trigger-maintained and its best available proxy for "recently completed"; no `completed_at` column exists — open tasks are shown recently-touched first). A final in-memory slice (3 × 10 = 30) is the global safety cap, and one team's volume can never starve other teams out of the context. Fields: team name, title (≤140), status (`todo`/`in_progress`/`done`), due date (validated real calendar date, date only), assignment as `you` / `teammate` / `unassigned` (null/empty/whitespace assignees are `unassigned`). **No** task `details`, `created_by`, assignee names, or any other member information — the caller's own uid is only ever used for the `you`/`teammate` comparison and never appears in the output.
- Saved hackathons (caller's own `saved_hackathons` rows, ≤5): title (≤80), **`Stored status: <status> (unverified)`** — the stored `registration_status` is never presented as current fact; stored deadline (validated date only) is suffixed with **`(elapsed — do not treat as open)`** once past; and an `Archived` flag when `archived_at` is set. A **server-generated `Today: YYYY-MM-DD` (UTC)** anchor is included in the context so stored values cannot be read as current reality; the date is never derived from user input. Bookmarks survive archival (existing catalog behavior); unverified rows are excluded (catalog rule). No URLs, images, curator notes, or other catalog events. Deadlines/statuses are never invented — stored values only, always labelled as stored/unverified.

**Authorization boundaries:**
- Identity source remains the Firebase ID token only; the uid is derived server-side and never accepted from the client. Client-supplied uids remain rejected (400).
- All team-dependent reads are gated by the membership-derived team-id set **re-established inside `buildCallerContext`** (`team_members.user_uid = verified uid`). Team/project/task rows outside that set can never appear.
- Saved bookmarks are scoped to `saved_hackathons.user_id = verified uid`; catalog rows are read-only and limited to fields whitelisting title/status/deadline/archived flag/verification.
- No AI-generated SQL, no dynamic filters from model output, no URL fetching, no writes, no tools.

**Context-size limit:** hard ceiling `MAX_CONTEXT_CHARS = 2600` (~650 tokens) for the **complete serialized context** — the server-generated `Today` anchor, the caller profile, every section heading, line separators, inter-section blank lines, everything — enforced by one shared `pushSection()` budget that truncates list lines. Sections are assembled in priority order (Server context anchor, profile, teams, projects, tasks, saved hackathons); list lines are dropped from the end of each section; if the budget is exhausted, later sections are omitted entirely. The remaining-budget accounting can never go negative. Existing 7A request/history limits and Groq completion settings are unchanged.

**Failure behavior:** profile-read failure → `null` context → general assistance with `contextUsed=false` (unchanged). Membership-lookup failure → projects, tasks and teams are dropped entirely; profile and own saved bookmarks remain. A **teams-table read failure** behaves the same (team-dependent sections dropped; profile and saved bookmarks kept). Any single new-category query failure (projects / tasks / saved bookmarks / bookmark details) drops only that category and logs minimal metadata (no contents). An unexpected error while assembling context is caught in the route handler and degrades to general assistance with `contextUsed=false` — never a 500. Raw errors and query contents are never surfaced.

**Groq disclosure (both UIs):** disclosures state that Groq may process the user's message plus selected context — profile, teams, project details, minimized tasks (title/status/due date/assignment, never other members' identities) and saved hackathons — that PulsePoint does not store the conversation, that the information is not legal, medical or financial advice, and that answers may be wrong. Both UIs link the `/legal` Privacy notice. No retention/ZDR or provider guarantees are claimed — see the Privacy disclosure section above.

**Privacy implications:** project/task text and bookmark subjects are now sent to Groq (same posture as 7A — US infrastructure is disclosed in the `/assistant` UI; Groq retention/ZDR status depends on the organization's console settings and Groq's terms and must be verified by the founder before launch — no claim about it is made in the UIs). Nothing is persisted by PulsePoint. No new processors, tables, infrastructure, or environment variables.

**Status/limits unchanged:** `AI_ASSISTANT_ENABLED` stays `false` by default; Groq client, timeouts, rate limits, history trimming, and error mapping are unchanged; no migrations; no new packages.

**Security & correctness fixes (2026-11-19):** hardening pass over 7B-1 — the `MAX_CONTEXT_CHARS` ceiling now covers the complete serialized context including the server-generated `Today (UTC)` anchor and the profile, enforced by one shared budget with non-negative accounting; tasks are fetched with bounded per-team queries (≤5 open + ≤5 done per team, `updated_at desc`, final global safety cap 30) so one team cannot starve the others; saved-hackathon lines label stored status as `Stored status: … (unverified)` and annotate elapsed deadlines (`elapsed — do not treat as open`); date-only strings are validated as real calendar dates (regex alone rejected impossible days); null/empty/whitespace assignees serialize as `unassigned`; a teams-table read failure now drops only team-dependent sections (profile and saved bookmarks survive); the route wraps context assembly in a catch-all that degrades to general assistance (`contextUsed=false`, never a 500); both UIs state that AI responses are not legal, medical or financial advice and link `/legal`; task ordering is `updated_at desc` for done tasks (best available proxy for "recently completed"). Still not live-verified; `AI_ASSISTANT_ENABLED` remains `false`.

## Related

- `docs/progress-audit.md` — decision log and phase status (Phase 7 decision recorded 2026-11-17; original Gemini gate preserved as history).
- `docs/hackathons-sources.md` — the approval-ledger pattern this document mirrors for external providers.
- `docs/ai/matching-v1.md` — rules-v1 matching; unrelated to, and unaffected by, the assistant.
- `AGENTS.md` — architecture invariants (server-only secrets, token-verified privileged routes, no client-side Teams/hackathons queries).
- `PulsePoint_Joint_Project_Roadmap.pdf` — original roadmap; its Phase 7 gate ("founder approval required") remains in force for everything except the provider choice, which the founder changed on 2026-11-17.
