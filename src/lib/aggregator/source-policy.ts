import type { SourcePlatform } from "./types";

export type SourceAccessStatus =
  | "authorized"
  | "permission_pending"
  | "blocked_without_explicit_authorization";

export interface SourceAccessPolicy {
  status: SourceAccessStatus;
  reason: string;
}

export const SOURCE_ACCESS_POLICY: Record<SourcePlatform, SourceAccessPolicy> = {
  Unstop: {
    status: "permission_pending",
    reason: "A reachable public endpoint is not a published API license.",
  },
  HackerEarth: {
    status: "permission_pending",
    reason: "The endpoint referenced by the prototype has no verified public API license.",
  },
  Devfolio: {
    status: "permission_pending",
    reason: "The endpoint referenced by the prototype has no verified public API license.",
  },
  MLH: {
    status: "permission_pending",
    reason: "The public event directory is not a verified data feed license.",
  },
  Hack2skill: {
    status: "permission_pending",
    reason: "No published API or feed permission has been verified.",
  },
  SIH: {
    status: "permission_pending",
    reason: "No published API or feed permission has been verified.",
  },
  Devpost: {
    status: "blocked_without_explicit_authorization",
    reason: "Automated collection is excluded unless explicitly authorized.",
  },
  OrganizerFeed: {
    status: "permission_pending",
    reason: "Enable only for a documented feed/API with organizer authorization.",
  },
  Curated: {
    status: "authorized",
    reason:
      "In-house source: entries are authored and verified by PulsePoint curators and cite official URLs. No third-party feed permission is involved.",
  },
};

export function isSourceAuthorized(source: SourcePlatform): boolean {
  return SOURCE_ACCESS_POLICY[source].status === "authorized";
}
