/**
 * PulsePoint Hackathon Aggregator Types & Contracts
 */

export type SourcePlatform =
  | "HackerEarth"
  | "Devfolio"
  | "Unstop"
  | "MLH"
  | "Hack2skill"
  | "SIH"
  | "Devpost"
  | "OrganizerFeed"
  // Human-verified entries authored and published by PulsePoint curators.
  | "Curated";

export type HackathonMode = "Online" | "In Person" | "Hybrid";
export type RegistrationStatus = "Open" | "Closing Soon" | "Closed" | "Unknown";

export interface NormalizedHackathon {
  id: string; // unique deterministic id e.g. 'hackerearth-12345'
  slug: string;
  title: string;
  organizer: string | null;
  source_event_id?: string;
  source_platform: SourcePlatform;
  source_url: string;
  apply_url: string;
  banner_url?: string;
  mode: HackathonMode | null;
  location: string | null;
  registration_status: RegistrationStatus;
  registration_deadline?: string; // ISO string
  start_date?: string; // ISO string
  end_date?: string; // ISO string
  prize_pool: string | null;
  prize_usd: number | null;
  themes: string[];
  skills: string[];
  team_size_min: number | null;
  team_size_max: number | null;
  description: string | null;
  eligibility: string | null;
  featured: boolean;
  verified: boolean;
  verified_at?: string | null;
  discovered_at?: string;
  sync_hash: string;
  archived_at?: string | null;
}

export interface AdapterResult {
  source: SourcePlatform;
  events: NormalizedHackathon[];
  durationMs: number;
  error?: string;
}

export interface AggregatorAdapter {
  source: SourcePlatform;
  fetchEvents(): Promise<NormalizedHackathon[]>;
}

export interface AggregatorSyncSummary {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  totalDiscovered: number;
  totalInserted: number;
  totalUpdated: number;
  totalUnchanged: number;
  sourceBreakdown: Record<string, { discovered: number; error?: string }>;
  errors: string[];
}
