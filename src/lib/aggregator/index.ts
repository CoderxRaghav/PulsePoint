import "server-only";

import { getSupabaseAdminClient } from "../supabase-admin";
import type { AggregatorAdapter, AggregatorSyncSummary, NormalizedHackathon } from "./types";
import { deduplicateHackathons } from "./deduplication";
import { HackerEarthAdapter } from "./adapters/hackerearth";
import { DevfolioAdapter } from "./adapters/devfolio";
import { MLHAdapter } from "./adapters/mlh";
import { UnstopAdapter } from "./adapters/unstop";
import { isSourceAuthorized } from "./source-policy";

type SyncStatus = "synced" | "partial" | "failed" | "locked" | "cooldown" | "unavailable" | "error";

interface SyncResult {
  success: boolean;
  status: SyncStatus;
  message: string;
  summary?: AggregatorSyncSummary;
}

interface LockResult {
  acquired: boolean;
  resultStatus: "acquired" | "locked" | "cooldown";
  token: string | null;
  lastSyncCompletedAt: string | null;
  nextRefreshAt: string | null;
}

function parseLockResult(data: unknown): LockResult {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    throw new Error("The database returned an invalid global synchronization lock result.");
  }

  const result = row as Record<string, unknown>;
  if (
    typeof result.acquired !== "boolean" ||
    (result.result_status !== "acquired" &&
      result.result_status !== "locked" &&
      result.result_status !== "cooldown") ||
    (result.acquired_token !== null && typeof result.acquired_token !== "string")
  ) {
    throw new Error("The database returned an invalid global synchronization lock result.");
  }

  return {
    acquired: result.acquired,
    resultStatus: result.result_status,
    token: result.acquired_token,
    lastSyncCompletedAt:
      typeof result.last_sync_completed_at === "string" ? result.last_sync_completed_at : null,
    nextRefreshAt: typeof result.next_refresh_at === "string" ? result.next_refresh_at : null,
  };
}

export async function runHackathonAggregatorSync(): Promise<SyncResult> {
  const availableAdapters: AggregatorAdapter[] = [
    new HackerEarthAdapter(),
    new DevfolioAdapter(),
    new MLHAdapter(),
    new UnstopAdapter(),
  ];
  const adapters = availableAdapters.filter((adapter) => isSourceAuthorized(adapter.source));

  if (adapters.length === 0) {
    return {
      success: false,
      status: "unavailable",
      message: "No source connector is currently authorized. Listings remain limited to verified cached events.",
    };
  }

  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch (error: unknown) {
    return {
      success: false,
      status: "error",
      message: `Supabase admin connection failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const { data: lockData, error: lockError } = await supabase.rpc("acquire_hackathon_sync_lock");
  if (lockError) {
    return {
      success: false,
      status: "error",
      message: `Could not acquire the global synchronization lock: ${lockError.message}`,
    };
  }

  let lock: LockResult;
  try {
    lock = parseLockResult(lockData);
  } catch (error: unknown) {
    return {
      success: false,
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (!lock.acquired || !lock.token) {
    return {
      success: lock.resultStatus === "cooldown",
      status: lock.resultStatus === "locked" ? "locked" : "cooldown",
      message:
        lock.resultStatus === "locked"
          ? "A global refresh is already running. Its status is available from the sync endpoint."
          : `The global catalog is in cooldown${lock.nextRefreshAt ? ` until ${lock.nextRefreshAt}` : ""}.`,
    };
  }

  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const sourceBreakdown: AggregatorSyncSummary["sourceBreakdown"] = {};
  const errors: string[] = [];
  const rawEvents: NormalizedHackathon[] = [];
  let insertedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let cacheError: string | null = null;

  const adapterResults = await Promise.all(
    adapters.map(async (adapter) => {
      try {
        const events = await adapter.fetchEvents();
        sourceBreakdown[adapter.source] = { discovered: events.length };
        return { source: adapter.source, events };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        sourceBreakdown[adapter.source] = { discovered: 0, error: message };
        errors.push(`[${adapter.source}] ${message}`);
        return { source: adapter.source, events: [] };
      }
    })
  );
  for (const result of adapterResults) {
    rawEvents.push(...result.events);
  }

  const deduplicated = deduplicateHackathons(rawEvents);
  try {
    if (deduplicated.length > 0) {
      const upsertRows = deduplicated.map((event) => ({
        id: event.id,
        source_event_id: event.source_event_id || event.id.slice(event.id.indexOf("-") + 1),
        slug: event.slug,
        title: event.title,
        organizer: event.organizer || null,
        source_platform: event.source_platform,
        source_url: event.source_url,
        apply_url: event.apply_url,
        banner_url: event.banner_url || null,
        mode: event.mode || null,
        location: event.location || null,
        registration_status: event.registration_status,
        registration_deadline: event.registration_deadline || null,
        start_date: event.start_date || null,
        end_date: event.end_date || null,
        prize_pool: event.prize_pool || null,
        prize_usd: event.prize_usd ?? null,
        themes: event.themes,
        skills: event.skills,
        team_size_min: event.team_size_min ?? null,
        team_size_max: event.team_size_max ?? null,
        description: event.description || null,
        eligibility: event.eligibility || null,
        featured: false,
        verified: event.verified,
        verified_at: event.verified ? new Date().toISOString() : null,
        last_seen_at: new Date().toISOString(),
        archived_at: null,
        sync_hash: event.sync_hash,
      }));
      const ids = upsertRows.map((row) => row.id);
      const { data: existingRecords, error: existingError } = await supabase
        .from("hackathons")
        .select("id, sync_hash")
        .in("id", ids);
      if (existingError) {
        throw new Error(`Could not compare cached event versions: ${existingError.message}`);
      }

      const existingHashes = new Map((existingRecords || []).map((row) => [row.id, row.sync_hash]));
      for (const row of upsertRows) {
        const previousHash = existingHashes.get(row.id);
        if (previousHash === undefined) insertedCount++;
        else if (previousHash !== row.sync_hash) updatedCount++;
        else unchangedCount++;
      }

      const { error: upsertError } = await supabase
        .from("hackathons")
        .upsert(upsertRows, { onConflict: "id" });
      if (upsertError) {
        throw new Error(`Failed to cache external hackathons: ${upsertError.message}`);
      }
    }
  } catch (error: unknown) {
    cacheError = error instanceof Error ? error.message : String(error);
    errors.push(cacheError);
  }

  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startedMs;
  const summary: AggregatorSyncSummary = {
    startedAt,
    completedAt,
    durationMs,
    totalDiscovered: rawEvents.length,
    totalInserted: insertedCount,
    totalUpdated: updatedCount,
    totalUnchanged: unchangedCount,
    sourceBreakdown,
    errors,
  };
  const status = errors.length === 0 ? "completed" : rawEvents.length > 0 ? "partial" : "failed";
  const errorMessage = errors.length > 0 ? errors.join("; ") : null;

  const { data: released, error: releaseError } = await supabase.rpc(
    "release_hackathon_sync_lock",
    {
      p_lock_token: lock.token,
      p_status: status,
      p_success: status === "completed",
      p_total_discovered: deduplicated.length,
      p_total_inserted: insertedCount,
      p_total_updated: updatedCount,
      p_total_unchanged: unchangedCount,
      p_total_failed: errors.length,
      p_last_error: errorMessage,
      p_metadata: {
        durationMs,
        sourceBreakdown,
      },
    }
  );
  if (releaseError) {
    return {
      success: false,
      status: "error",
      message: `Synchronization finished, but its global state could not be saved: ${releaseError.message}`,
      summary,
    };
  }
  if (released !== true) {
    return {
      success: false,
      status: "error",
      message: "Synchronization finished after its global lock lease was lost; state was not overwritten.",
      summary,
    };
  }

  if (cacheError) {
    return { success: false, status: "failed", message: cacheError, summary };
  }

  return {
    success: status === "completed",
    status: status === "completed" ? "synced" : status,
    message:
      status === "completed"
        ? `Synchronized ${deduplicated.length} external events (${insertedCount} new, ${updatedCount} updated).`
        : status === "partial"
          ? `Refresh completed with source failures. ${deduplicated.length} verified events were processed.`
          : `Refresh failed: ${errorMessage || "all enabled sources failed"}.`,
    summary,
  };
}
