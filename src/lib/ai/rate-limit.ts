import "server-only";

/**
 * Best-effort, per-user rate limiting for the Phase 7A assistant.
 *
 * In-memory and per server process: limits are NOT shared across serverless
 * instances or across restarts. Groq's organization-level free-tier quotas
 * (30 req/min, 1,000 req/day for openai/gpt-oss-20b) remain the hard
 * backstop. This throttle exists so a single caller cannot monopolize the
 * shared org quota; it is deliberately conservative.
 *
 * Fixed-window counters keyed by verified Firebase UID. No message contents
 * or profile data are stored here — only counters and timestamps.
 */

export const ASSISTANT_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
export const ASSISTANT_RATE_LIMIT_MAX_PER_WINDOW = 10;
export const ASSISTANT_RATE_LIMIT_MAX_PER_DAY = 30;

interface Bucket {
  windowStart: number;
  windowCount: number;
  dayStart: number;
  dayCount: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;

function dayStartOf(now: number) {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function pruneExpired(now: number) {
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    const dayExpired = now - dayStartOf(now) >= 24 * 60 * 60 * 1000 || bucket.dayStart !== dayStartOf(now);
    const windowExpired = now - bucket.windowStart > ASSISTANT_RATE_LIMIT_WINDOW_MS;
    if (dayExpired && windowExpired) buckets.delete(key);
  }
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number; reason: "window" | "day" };

export function checkAssistantRateLimit(uid: string, now: number = Date.now()): RateLimitResult {
  pruneExpired(now);
  const dayStart = dayStartOf(now);
  const existing = buckets.get(uid);

  const bucket: Bucket = existing && existing.dayStart === dayStart
    ? { ...existing }
    : { windowStart: now, windowCount: 0, dayStart, dayCount: 0 };

  if (now - bucket.windowStart >= ASSISTANT_RATE_LIMIT_WINDOW_MS) {
    bucket.windowStart = now;
    bucket.windowCount = 0;
  }

  if (bucket.dayCount >= ASSISTANT_RATE_LIMIT_MAX_PER_DAY) {
    buckets.set(uid, bucket);
    const retryAfterSeconds = Math.max(1, Math.ceil((dayStart + 24 * 60 * 60 * 1000 - now) / 1000));
    return { ok: false, retryAfterSeconds, reason: "day" };
  }

  if (bucket.windowCount >= ASSISTANT_RATE_LIMIT_MAX_PER_WINDOW) {
    buckets.set(uid, bucket);
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.windowStart + ASSISTANT_RATE_LIMIT_WINDOW_MS - now) / 1000));
    return { ok: false, retryAfterSeconds, reason: "window" };
  }

  bucket.windowCount += 1;
  bucket.dayCount += 1;
  buckets.set(uid, bucket);
  return { ok: true };
}

/** Test hook: clears all counters. Not used by application code. */
export function resetAssistantRateLimits() {
  buckets.clear();
}
