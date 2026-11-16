import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  createMockSupabase,
  SAMPLE_HACKATHON_ROW,
  type MockSupabase,
  type MockSupabaseOptions,
  type TableHandler,
} from "../helpers/mock-supabase";

// Stub the build-time guard so route handlers can be imported under vitest.
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  supabase: null as MockSupabase | null,
  firebaseUid: null as string | null,
  firebaseThrows: null as Error | null,
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: () => {
    if (!mocks.supabase) throw new Error("mock supabase not configured");
    return mocks.supabase;
  },
}));

vi.mock("@/lib/firebase-admin", () => ({
  verifyFirebaseIdToken: async (token: string) => {
    if (mocks.firebaseThrows) throw mocks.firebaseThrows;
    if (token === "student-token") return "uid-student";
    if (token === "curator-token") return "uid-curator";
    if (mocks.firebaseUid) return mocks.firebaseUid;
    throw new Error("The Firebase ID token is invalid or expired.");
  },
}));

import { GET as listHackathons } from "@/app/api/hackathons/route";
import { GET as detailHackathon } from "@/app/api/hackathons/[id]/route";
import { GET as listSaved, POST as saveHackathon, DELETE as unsaveHackathon } from "@/app/api/hackathons/saved/route";
import { POST as submitSuggestion, GET as mySuggestions } from "@/app/api/hackathons/suggestions/route";
import { POST as createCurated } from "@/app/api/admin/hackathons/route";
import { PATCH as patchCurated } from "@/app/api/admin/hackathons/[id]/route";
import { POST as archiveExpired } from "@/app/api/admin/hackathons/archive-expired/route";
import { PATCH as moderateSuggestion } from "@/app/api/admin/hackathons/suggestions/[id]/route";

const FUTURE = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
const PAST = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();

function buildSupabase(
  handlers: Record<string, TableHandler> = {},
  rpc?: MockSupabaseOptions["rpc"]
) {
  mocks.supabase = createMockSupabase({ handlers, rpc });
  return mocks.supabase;
}

function defaultLiveRows() {
  return [SAMPLE_HACKATHON_ROW, { ...SAMPLE_HACKATHON_ROW, id: "curated-two", slug: "two", title: "Two", prize_usd: 400 }];
}

function liveAndClosedHandler(q: import("../helpers/mock-supabase").RecordedQuery) {
  const cols = String(q.selectArg ?? "");
  if (cols.startsWith("prize_usd, organizer")) {
    return {
      data: [
        { prize_usd: 600, organizer: "Example University", source_platform: "Curated", mode: "Online", registration_deadline: FUTURE },
        { prize_usd: 0, organizer: "Example University", source_platform: "Curated", mode: "In Person", registration_deadline: PAST },
      ],
      error: null,
    };
  }
  return { data: defaultLiveRows(), error: null, count: 2 };
}

describe("GET /api/hackathons", () => {
  beforeEach(() => buildSupabase({ hackathons: liveAndClosedHandler, hackathon_sync_state: () => ({ data: { status: "idle", last_sync_completed_at: null, total_discovered: 2 }, error: null }) }));
  afterEach(() => vi.unstubAllEnvs());

  it("returns verified live events with recomputed status and phase", async () => {
    const res = await listHackathons(new NextRequest("http://test/api/hackathons"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hackathons).toHaveLength(2);
    expect(body.hackathons[0].phase).toBeDefined();
    expect(body.total).toBe(2);
    expect(body.includeClosed).toBe(false);
  });

  it("hides past-deadline events by default at the SQL layer, and honors include_closed", async () => {
    mocks.supabase = createMockSupabase({
      handlers: {
        hackathons: (q) => {
          const cols = String(q.selectArg ?? "");
          if (cols.startsWith("prize_usd, organizer")) return { data: [], error: null };
          return { data: defaultLiveRows(), error: null, count: 2 };
        },
        hackathon_sync_state: () => ({ data: { status: "idle" }, error: null }),
      },
    });
    await listHackathons(new NextRequest("http://test/api/hackathons"));
    const defaultQuery = mocks.supabase.queries.find((q) => String(q.selectArg).startsWith("id, slug"));
    expect(defaultQuery?.ors.join(" ")).toContain("registration_deadline.is.null,registration_deadline.gte.");

    await listHackathons(new NextRequest("http://test/api/hackathons?include_closed=true"));
    const closedQuery = mocks.supabase.queries.filter((q) => String(q.selectArg).startsWith("id, slug")).at(-1);
    expect(closedQuery?.ors.join(" ") ?? "").not.toContain("registration_deadline.is.null");
  });

  it("applies status=Closed as a SQL filter and implies include_closed", async () => {
    const res = await listHackathons(new NextRequest("http://test/api/hackathons?status=Closed"));
    const body = await res.json();
    expect(body.includeClosed).toBe(true);
    const pageQuery = mocks.supabase?.queries.find((q) => String(q.selectArg).startsWith("id, slug"));
    expect(pageQuery?.filters).toContainEqual(["lt", "registration_deadline", expect.any(String)]);
  });

  it("returns the default page size (24) when pageSize is not provided", async () => {
    await listHackathons(new NextRequest("http://test/api/hackathons"));
    const pageQuery = mocks.supabase?.queries.find((q) => String(q.selectArg).startsWith("id, slug"));
    expect(pageQuery?.rangeArgs).toEqual([0, 23]);

    await listHackathons(new NextRequest("http://test/api/hackathons?pageSize=50&page=2"));
    const page2 = mocks.supabase?.queries.filter((q) => String(q.selectArg).startsWith("id, slug")).at(-1);
    expect(page2?.rangeArgs).toEqual([50, 99]);
  });

  it("sanitizes search input and passes it as ilike constraints", async () => {
    const res = await listHackathons(new NextRequest("http://test/api/hackathons?query=a%25%2Cb%28c%29"));
    expect(res.status).toBe(200);
    const pageQuery = mocks.supabase?.queries.find((q) => String(q.selectArg).startsWith("id, slug"));
    const searchClause = pageQuery?.ors.find((expr) => expr.includes("ilike")) ?? "";
    expect(searchClause).toContain("ilike");
    expect(searchClause).not.toContain("%25");
    expect(searchClause).not.toMatch(/[()]/);
    // Injected separators were neutralized into spaces inside the pattern.
    expect(searchClause).toContain("%a b c%");
  });

  it("rejects an invalid deadline_before with 400", async () => {
    const res = await listHackathons(new NextRequest("http://test/api/hackathons?deadline_before=nonsense"));
    expect(res.status).toBe(400);
  });

  it("marks expired events as Closed even if the cache said otherwise", async () => {
    mocks.supabase = createMockSupabase({
      handlers: {
        hackathons: (q) => {
          const cols = String(q.selectArg ?? "");
          if (cols.startsWith("prize_usd, organizer")) return { data: [], error: null };
          return { data: [{ ...SAMPLE_HACKATHON_ROW, registration_deadline: PAST, registration_status: "Open" }], error: null, count: 1 };
        },
        hackathon_sync_state: () => ({ data: { status: "idle" }, error: null }),
      },
    });
    const res = await listHackathons(new NextRequest("http://test/api/hackathons?include_closed=true"));
    const body = await res.json();
    expect(body.hackathons[0].registration_status).toBe("Closed");
    expect(body.hackathons[0].phase).toBe("registration_closed");
  });

  it("computes live-catalog statistics from lightweight columns", async () => {
    const res = await listHackathons(new NextRequest("http://test/api/hackathons"));
    const body = await res.json();
    expect(body.stats.totalLive).toBe(1);
    expect(body.stats.totalClosed).toBe(1);
    expect(body.stats.onlineCount).toBe(1);
    expect(body.stats.inPersonCount).toBe(0);
    expect(body.stats.totalPrizeUsd).toBe(600);
    expect(body.stats.uniqueOrganizers).toBe(1);
  });

  it("returns 503 when the database read fails", async () => {
    mocks.supabase = createMockSupabase({
      handlers: { hackathons: () => ({ data: null, error: { message: "boom" } }) },
    });
    const res = await listHackathons(new NextRequest("http://test/api/hackathons"));
    expect(res.status).toBe(503);
  });
});

describe("GET /api/hackathons/[id]", () => {
  it("returns 404 for unknown ids and slugs", async () => {
    buildSupabase({ hackathons: () => ({ data: null, error: null }) });
    const res = await detailHackathon(new NextRequest("http://test/api/hackathons/nope"), { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
  });

  it("serves verified events and flags archived ones for the ended banner", async () => {
    buildSupabase({
      hackathons: (q) => {
        if (q.filters.some(([m, col, val]) => m === "eq" && col === "id" && val === "curated-sample-hack-2026")) {
          return { data: { ...SAMPLE_HACKATHON_ROW, archived_at: new Date().toISOString() }, error: null };
        }
        return { data: null, error: null };
      },
    });
    const res = await detailHackathon(new NextRequest("http://test/api/hackathons/curated-sample-hack-2026"), { params: Promise.resolve({ id: "curated-sample-hack-2026" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hackathon.archived).toBe(true);
    expect(body.hackathon.phase).toBeDefined();
  });
});

describe("saved hackathons (bookmarks)", () => {
  beforeEach(() => {
    buildSupabase({
      saved_hackathons: (q) => {
        const insert = q.filters.find(([m]) => m === "insert" || m === "upsert");
        if (insert) return { data: null, error: null };
        if (q.filters.some(([m]) => m === "delete")) return { data: null, error: null };
        return { data: [{ hackathon_id: "curated-sample-hack-2026" }], error: null };
      },
    });
  });

  it("rejects unauthenticated requests", async () => {
    const res = await listSaved(new NextRequest("http://test/api/hackathons/saved"));
    expect(res.status).toBe(401);
  });

  it("lists the caller's bookmarks", async () => {
    const res = await listSaved(new NextRequest("http://test/api/hackathons/saved", { headers: { authorization: "Bearer student-token" } }));
    expect(res.status).toBe(200);
    expect((await res.json()).savedIds).toEqual(["curated-sample-hack-2026"]);
    const q = mocks.supabase?.queries[0];
    expect(q?.filters).toContainEqual(["eq", "user_id", "uid-student"]);
  });

  it("saves with the authenticated uid, never a body-supplied one", async () => {
    const res = await saveHackathon(
      new NextRequest("http://test/api/hackathons/saved", {
        method: "POST",
        headers: { authorization: "Bearer student-token", "content-type": "application/json" },
        body: JSON.stringify({ hackathonId: "curated-sample-hack-2026", user_id: "attacker" }),
      })
    );
    expect(res.status).toBe(200);
    const q = mocks.supabase?.queries[0];
    const upsert = q?.filters.find(([m]) => m === "upsert");
    expect(upsert?.[2]).toMatchObject({ user_id: "uid-student", hackathon_id: "curated-sample-hack-2026" });
  });

  it("validates the bookmark body", async () => {
    const res = await saveHackathon(
      new NextRequest("http://test/api/hackathons/saved", {
        method: "POST",
        headers: { authorization: "Bearer student-token", "content-type": "application/json" },
        body: JSON.stringify({ hackathonId: 42 }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("removes a bookmark scoped to the caller", async () => {
    const res = await unsaveHackathon(
      new NextRequest("http://test/api/hackathons/saved", {
        method: "DELETE",
        headers: { authorization: "Bearer student-token", "content-type": "application/json" },
        body: JSON.stringify({ hackathonId: "curated-sample-hack-2026" }),
      })
    );
    expect(res.status).toBe(200);
    const q = mocks.supabase?.queries[0];
    expect(q?.filters).toContainEqual(["match", "user_id", "uid-student"]);
    expect(q?.filters).toContainEqual(["match", "hackathon_id", "curated-sample-hack-2026"]);
  });
});

describe("POST /api/hackathons/suggestions (student submissions)", () => {
  const validBody = {
    title: "IIIT Bangalore TechSprint 2026",
    source_url: "https://iiitb.ac.in/techsprint",
    apply_url: "https://iiitb.ac.in/techsprint/register",
    mode: "In Person",
  };

  it("rejects unauthenticated submissions", async () => {
    buildSupabase();
    const res = await submitSuggestion(
      new NextRequest("http://test/api/hackathons/suggestions", { method: "POST", body: JSON.stringify(validBody) })
    );
    expect(res.status).toBe(401);
  });

  it("rejects invalid payloads with details", async () => {
    buildSupabase();
    const res = await submitSuggestion(
      new NextRequest("http://test/api/hackathons/suggestions", {
        method: "POST",
        headers: { authorization: "Bearer student-token", "content-type": "application/json" },
        body: JSON.stringify({ title: "x", source_url: "javascript:bad", apply_url: "" }),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).details.length).toBeGreaterThan(0);
  });

  it("creates a pending suggestion owned by the caller", async () => {
    buildSupabase({
      hackathon_suggestions: (q) => {
        const insert = q.filters.find(([m]) => m === "insert");
        if (insert) {
          return { data: { id: "uuid-1", status: "pending", created_at: new Date().toISOString() }, error: null };
        }
        return { data: null, error: null }; // no duplicate pending
      },
    });
    const res = await submitSuggestion(
      new NextRequest("http://test/api/hackathons/suggestions", {
        method: "POST",
        headers: { authorization: "Bearer student-token", "content-type": "application/json" },
        body: JSON.stringify(validBody),
      })
    );
    expect(res.status).toBe(201);
    const insertQuery = mocks.supabase?.queries.find((q) => q.filters.some(([m]) => m === "insert"));
    const values = insertQuery?.filters.find(([m]) => m === "insert")?.[2] as Record<string, unknown>;
    expect(values.status).toBe("pending");
    expect(values.submitted_by).toBe("uid-student");
    expect(values).not.toHaveProperty("verified");
    expect(values).not.toHaveProperty("featured");
  });

  it("rejects a duplicate pending submission from the same student", async () => {
    buildSupabase({
      hackathon_suggestions: () => ({ data: { id: "existing", status: "pending" }, error: null }),
    });
    const res = await submitSuggestion(
      new NextRequest("http://test/api/hackathons/suggestions", {
        method: "POST",
        headers: { authorization: "Bearer student-token", "content-type": "application/json" },
        body: JSON.stringify(validBody),
      })
    );
    expect(res.status).toBe(409);
  });
});

describe("curator authorization on admin routes", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns 503 when no curator allowlist is configured", async () => {
    vi.stubEnv("HACKATHON_CURATOR_UIDS", "");
    buildSupabase();
    const res = await createCurated(
      new NextRequest("http://test/api/admin/hackathons", {
        method: "POST",
        headers: { authorization: "Bearer curator-token", "content-type": "application/json" },
        body: JSON.stringify({ title: "X".repeat(10), source_url: "https://x.example.org", apply_url: "https://x.example.org/r" }),
      })
    );
    expect(res.status).toBe(503);
  });

  it("returns 403 for authenticated non-curators", async () => {
    vi.stubEnv("HACKATHON_CURATOR_UIDS", "uid-curator");
    buildSupabase();
    const res = await createCurated(
      new NextRequest("http://test/api/admin/hackathons", {
        method: "POST",
        headers: { authorization: "Bearer student-token", "content-type": "application/json" },
        body: JSON.stringify({ title: "A perfectly valid title", source_url: "https://x.example.org", apply_url: "https://x.example.org/r" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("publishes a curated listing for an allowlisted curator and audits it", async () => {
    vi.stubEnv("HACKATHON_CURATOR_UIDS", "uid-curator");
    buildSupabase({
      hackathons: (q) => {
        if (q.filters.some(([m, col]) => m === "eq" && col === "slug")) return { data: [], error: null }; // no dedup match
        if (q.filters.some(([m]) => m === "insert")) return { data: null, error: null };
        return { data: [], error: null };
      },
      hackathon_audit_log: () => ({ data: null, error: null }),
    });
    const res = await createCurated(
      new NextRequest("http://test/api/admin/hackathons", {
        method: "POST",
        headers: { authorization: "Bearer curator-token", "content-type": "application/json" },
        body: JSON.stringify({
          title: "SIH 2026 Software Edition",
          source_url: "https://sih.gov.in/2026",
          apply_url: "https://sih.gov.in/2026/register",
          mode: "Hybrid",
        }),
      })
    );
    expect(res.status).toBe(201);
    const insertQuery = mocks.supabase?.queries.find((q) => q.filters.some(([m]) => m === "insert" && q.table === "hackathons"));
    const values = insertQuery?.filters.find(([m]) => m === "insert")?.[2] as Record<string, unknown>;
    expect(values.verified).toBe(true);
    expect(values.submitted_by).toBe("uid-curator");
    expect(values.source_platform).toBe("Curated");
    const audit = mocks.supabase?.queries.find((q) => q.table === "hackathon_audit_log");
    expect(audit?.filters.some(([m]) => m === "insert")).toBe(true);
  });

  it("returns 409 with dedup matches unless confirmed", async () => {
    vi.stubEnv("HACKATHON_CURATOR_UIDS", "uid-curator");
    buildSupabase({
      hackathons: (q) => {
        if (q.filters.some(([m, col]) => m === "eq" && col === "slug")) {
          return { data: [{ id: "curated-sih-2026-software-edition", slug: "sih-2026-software-edition", title: "SIH 2026 Software Edition", source_platform: "Curated", registration_deadline: null, archived_at: null }], error: null };
        }
        return { data: null, error: null };
      },
    });
    const res = await createCurated(
      new NextRequest("http://test/api/admin/hackathons", {
        method: "POST",
        headers: { authorization: "Bearer curator-token", "content-type": "application/json" },
        body: JSON.stringify({ title: "SIH 2026 Software Edition", source_url: "https://sih.gov.in/2026", apply_url: "https://sih.gov.in/2026/register" }),
      })
    );
    expect(res.status).toBe(409);
    expect((await res.json()).matches).toHaveLength(1);
  });
});

describe("PATCH /api/admin/hackathons/[id] actions", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("archives a listing and audits the action", async () => {
    vi.stubEnv("HACKATHON_CURATOR_UIDS", "uid-curator");
    buildSupabase({
      hackathons: (q) => {
        if (q.filters.some(([m]) => m === "update")) return { data: null, error: null };
        return { data: { id: "curated-two", slug: "two", title: "Two", verified: true, verified_at: null, featured: false, archived_at: null, registration_deadline: null, registration_status: "Open" }, error: null };
      },
      hackathon_audit_log: () => ({ data: null, error: null }),
    });
    const res = await patchCurated(
      new NextRequest("http://test/api/admin/hackathons/curated-two", {
        method: "PATCH",
        headers: { authorization: "Bearer curator-token", "content-type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      }),
      { params: Promise.resolve({ id: "curated-two" }) }
    );
    expect(res.status).toBe(200);
    const updateQuery = mocks.supabase?.queries.find((q) => q.filters.some(([m]) => m === "update"));
    const updateValues = updateQuery?.filters.find(([m]) => m === "update")?.[2] as Record<string, unknown>;
    expect(updateValues.archived_at).toBeTruthy();
  });
});

describe("POST /api/admin/hackathons/archive-expired", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("runs the archival function and reports the count", async () => {
    vi.stubEnv("HACKATHON_CURATOR_UIDS", "uid-curator");
    buildSupabase(
      { hackathon_audit_log: () => ({ data: null, error: null }) },
      { archive_expired_hackathons: { data: 3, error: null } }
    );
    const res = await archiveExpired(
      new NextRequest("http://test/api/admin/hackathons/archive-expired", {
        method: "POST",
        headers: { authorization: "Bearer curator-token" },
      })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).archived).toBe(3);
    expect(mocks.supabase?.rpcCalls[0]?.name).toBe("archive_expired_hackathons");
  });

  it("denies non-curators", async () => {
    vi.stubEnv("HACKATHON_CURATOR_UIDS", "uid-curator");
    buildSupabase();
    const res = await archiveExpired(
      new NextRequest("http://test/api/admin/hackathons/archive-expired", {
        method: "POST",
        headers: { authorization: "Bearer student-token" },
      })
    );
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/admin/hackathons/suggestions/[id] (moderation)", () => {
  afterEach(() => vi.unstubAllEnvs());

  const storedSuggestion = {
    id: "123e4567-e89b-42d3-a456-426655440000",
    submitted_by: "uid-student",
    title: "IIIT Bangalore TechSprint",
    organizer: "IIIT Bangalore",
    source_url: "https://iiitb.ac.in/techsprint",
    apply_url: "https://iiitb.ac.in/techsprint/register",
    mode: "In Person",
    location: "Bengaluru",
    registration_deadline: FUTURE,
    start_date: null,
    end_date: null,
    prize_pool: null,
    description: "A student-run buildathon.",
    eligibility: "Students.",
    themes: ["Web"],
    status: "pending",
    published_hackathon_id: null,
    review_notes: null,
  };

  function setupModeration(overrides: Record<string, unknown> = {}) {
    vi.stubEnv("HACKATHON_CURATOR_UIDS", "uid-curator");
    buildSupabase({
      hackathon_suggestions: (q) => {
        if (q.maybeSingle) return { data: { ...storedSuggestion, ...overrides }, error: null };
        return { data: null, error: null };
      },
      hackathons: (q) => {
        if (q.filters.some(([m, col]) => m === "eq" && col === "slug")) return { data: [], error: null };
        if (q.filters.some(([m]) => m === "insert")) return { data: null, error: null };
        return { data: [], error: null };
      },
      hackathon_audit_log: () => ({ data: null, error: null }),
    });
  }

  it("approve keeps the suggestion pending review with audit trail", async () => {
    setupModeration();
    const res = await moderateSuggestion(
      new NextRequest("http://test/api/admin/hackathons/suggestions/123e4567-e89b-42d3-a456-426655440000", {
        method: "PATCH",
        headers: { authorization: "Bearer curator-token", "content-type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      }),
      { params: Promise.resolve({ id: "123e4567-e89b-42d3-a456-426655440000" }) }
    );
    expect(res.status).toBe(200);
    const update = mocks.supabase?.queries.find((q) => q.table === "hackathon_suggestions" && q.filters.some(([m]) => m === "update"));
    const values = update?.filters.find(([m]) => m === "update")?.[2] as Record<string, unknown>;
    expect(values.status).toBe("approved");
    expect(values.reviewer_uid).toBe("uid-curator");
  });

  it("publish creates a verified Curated listing and marks the suggestion published", async () => {
    setupModeration({ status: "approved" });
    const res = await moderateSuggestion(
      new NextRequest("http://test/api/admin/hackathons/suggestions/123e4567-e89b-42d3-a456-426655440000", {
        method: "PATCH",
        headers: { authorization: "Bearer curator-token", "content-type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      }),
      { params: Promise.resolve({ id: "123e4567-e89b-42d3-a456-426655440000" }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.hackathonId).toMatch(/^curated-/);
    const hackathonInsert = mocks.supabase?.queries.find((q) => q.table === "hackathons" && q.filters.some(([m]) => m === "insert"));
    const listing = hackathonInsert?.filters.find(([m]) => m === "insert")?.[2] as Record<string, unknown>;
    expect(listing.verified).toBe(true);
    expect(listing.source_platform).toBe("Curated");
    expect(listing.curation_notes).toContain("student suggestion");
    const mark = mocks.supabase?.queries.find((q) => q.table === "hackathon_suggestions" && q.filters.some(([m]) => m === "update"));
    expect((mark?.filters.find(([m]) => m === "update")?.[2] as Record<string, unknown>).status).toBe("published");
  });

  it("rejects publishing a suggestion whose URLs are invalid", async () => {
    setupModeration({ source_url: "not-a-url" });
    const res = await moderateSuggestion(
      new NextRequest("http://test/api/admin/hackathons/suggestions/123e4567-e89b-42d3-a456-426655440000", {
        method: "PATCH",
        headers: { authorization: "Bearer curator-token", "content-type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      }),
      { params: Promise.resolve({ id: "123e4567-e89b-42d3-a456-426655440000" }) }
    );
    expect(res.status).toBe(400);
  });

  it("rejects unauthenticated moderation", async () => {
    buildSupabase();
    const res = await moderateSuggestion(
      new NextRequest("http://test/api/admin/hackathons/suggestions/123e4567-e89b-42d3-a456-426655440000", {
        method: "PATCH",
        body: JSON.stringify({ action: "reject" }),
      }),
      { params: Promise.resolve({ id: "123e4567-e89b-42d3-a456-426655440000" }) }
    );
    expect(res.status).toBe(401);
  });
});

describe("suggestion visibility", () => {
  it("lists only the caller's own suggestions", async () => {
    buildSupabase({
      hackathon_suggestions: () => ({ data: [{ id: "s1", title: "Mine", status: "pending" }], error: null }),
    });
    const res = await mySuggestions(new NextRequest("http://test/api/hackathons/suggestions", { headers: { authorization: "Bearer student-token" } }));
    expect(res.status).toBe(200);
    expect((await res.json()).suggestions).toHaveLength(1);
    const q = mocks.supabase?.queries[0];
    expect(q?.filters).toContainEqual(["eq", "submitted_by", "uid-student"]);
  });
});
