/**
 * Programmable mock for the untyped Supabase client used across the app.
 * Records every constraint the route builds so tests can assert on the exact
 * PostgREST operations issued, and returns canned data per table.
 */

export interface RecordedQuery {
  table: string;
  selectArg: string | string[] | null;
  countExact: boolean;
  filters: Array<[method: string, column: string, value: unknown]>;
  ors: string[];
  orders: Array<{ column: string; ascending: boolean; nullsFirst?: boolean }>;
  rangeArgs: [number, number] | null;
  limitArg: number | null;
  single: boolean;
  maybeSingle: boolean;
  inFilters: Array<[column: string, values: unknown[]]>;
  notFilters: Array<[column: string, operator: string, value: unknown]>;
}

export interface CannedResult {
  data: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
}

export type TableHandler = (query: RecordedQuery) => CannedResult;

export interface MockSupabaseOptions {
  handlers?: Record<string, TableHandler>;
  rpc?: Record<string, CannedResult>;
}

export function createMockSupabase(options: MockSupabaseOptions = {}) {
  const queries: RecordedQuery[] = [];

  function from(table: string) {
    const query: RecordedQuery = {
      table,
      selectArg: null,
      countExact: false,
      filters: [],
      ors: [],
      orders: [],
      rangeArgs: null,
      limitArg: null,
      single: false,
      maybeSingle: false,
      inFilters: [],
      notFilters: [],
    };
    queries.push(query);

    const handler = options.handlers?.[table];
    const run = (): CannedResult =>
      handler
        ? handler(query)
        : { data: query.maybeSingle || query.single ? null : [], error: null };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {
      select(cols: string | string[], opts?: { count?: string }) {
        query.selectArg = cols ?? null;
        query.countExact = opts?.count === "exact";
        return builder;
      },
      eq(col: string, val: unknown) { query.filters.push(["eq", col, val]); return builder; },
      neq(col: string, val: unknown) { query.filters.push(["neq", col, val]); return builder; },
      is(col: string, val: unknown) { query.filters.push(["is", col, val]); return builder; },
      gt(col: string, val: unknown) { query.filters.push(["gt", col, val]); return builder; },
      gte(col: string, val: unknown) { query.filters.push(["gte", col, val]); return builder; },
      lt(col: string, val: unknown) { query.filters.push(["lt", col, val]); return builder; },
      lte(col: string, val: unknown) { query.filters.push(["lte", col, val]); return builder; },
      contains(col: string, val: unknown) { query.filters.push(["contains", col, val]); return builder; },
      overlaps(col: string, val: unknown) { query.filters.push(["overlaps", col, val]); return builder; },
      ilike(col: string, val: unknown) { query.filters.push(["ilike", col, val]); return builder; },
      or(expr: string) { query.ors.push(expr); return builder; },
      not(col: string, operator: string, val: unknown) { query.notFilters.push([col, operator, val]); return builder; },
      in(col: string, vals: unknown[]) { query.inFilters.push([col, vals]); return builder; },
      order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
        query.orders.push({ column: col, ascending: opts?.ascending !== false, nullsFirst: opts?.nullsFirst });
        return builder;
      },
      range(fromIndex: number, toIndex: number) { query.rangeArgs = [fromIndex, toIndex]; return builder; },
      limit(count: number) { query.limitArg = count; return builder; },
      single() { query.single = true; return builder; },
      maybeSingle() { query.maybeSingle = true; return builder; },
      insert(values: unknown) {
        query.filters.push(["insert", "", values]);
        return Object.assign(builder, { inserted: values });
      },
      update(values: unknown) {
        query.filters.push(["update", "", values]);
        return builder;
      },
      upsert(values: unknown) {
        query.filters.push(["upsert", "", values]);
        return builder;
      },
      delete() { query.filters.push(["delete", "", null]); return builder; },
      match(values: Record<string, unknown>) {
        for (const [key, val] of Object.entries(values)) query.filters.push(["match", key, val]);
        return builder;
      },
      then(resolve: (result: unknown) => unknown, reject: (reason: unknown) => unknown) {
        return Promise.resolve(run()).then(resolve, reject);
      },
    };
    return builder;
  }

  const rpcCalls: Array<{ name: string; args: unknown }> = [];
  async function rpc(name: string, args?: unknown) {
    rpcCalls.push({ name, args });
    return options.rpc?.[name] ?? { data: null, error: null };
  }

  return { from, rpc, queries, rpcCalls };
}

export type MockSupabase = ReturnType<typeof createMockSupabase>;

export const SAMPLE_HACKATHON_ROW = {
  id: "curated-sample-hack-2026",
  slug: "sample-hack-2026",
  title: "Sample Hack 2026",
  organizer: "Example University",
  source_platform: "Curated",
  source_url: "https://example.org/events/sample-hack-2026",
  apply_url: "https://example.org/events/sample-hack-2026/register",
  banner_url: null,
  mode: "Online",
  location: "Worldwide",
  registration_status: "Open",
  registration_deadline: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
  start_date: new Date(Date.now() + 21 * 24 * 3600 * 1000).toISOString(),
  end_date: new Date(Date.now() + 22 * 24 * 3600 * 1000).toISOString(),
  prize_pool: "₹50,000",
  prize_usd: 600,
  themes: ["AI/ML"],
  skills: ["Python"],
  team_size_min: 2,
  team_size_max: 4,
  description: "A curated example event.",
  eligibility: "Students from any college.",
  featured: false,
  verified: true,
  verified_at: new Date().toISOString(),
  discovered_at: new Date().toISOString(),
  sync_hash: "abc123",
  source_event_id: "sample-hack-2026",
  archived_at: null,
};
