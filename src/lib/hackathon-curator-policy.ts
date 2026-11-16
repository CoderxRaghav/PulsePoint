/**
 * Hackathon curator allowlist policy (pure; unit-testable).
 * The server-only request guard lives in hackathon-curators.ts.
 */

export const CURATOR_UIDS_ENV = "HACKATHON_CURATOR_UIDS";

/** Parses a comma-separated allowlist of Firebase UIDs. Empty/missing → no curators (deny all). */
export function parseCuratorUids(raw: string | undefined | null): Set<string> {
  if (!raw) return new Set();
  const uids = raw
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && entry.length <= 128 && !/\s/.test(entry));
  return new Set(uids);
}

export function isHackathonCurator(uid: string | null | undefined, curators: Set<string>): boolean {
  if (!uid) return false;
  return curators.has(uid);
}

/** Reads the allowlist from the server environment. Empty env → empty set (deny all). */
export function getHackathonCuratorUids(): Set<string> {
  return parseCuratorUids(process.env[CURATOR_UIDS_ENV]);
}
