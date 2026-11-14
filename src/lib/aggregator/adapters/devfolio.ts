import { AggregatorAdapter, NormalizedHackathon, HackathonMode } from "../types";
import { isSourceAuthorized } from "../source-policy";
import { generateCanonicalSlug, computeSyncHash, calculateRegistrationStatus } from "../deduplication";

interface DevfolioItem {
  slug?: string;
  name?: string;
  tagline?: string;
  location?: string;
  starts_at?: string;
  ends_at?: string;
  banner_url?: string;
  is_online?: boolean;
  open_to_all?: boolean;
}

export class DevfolioAdapter implements AggregatorAdapter {
  source = "Devfolio" as const;

  async fetchEvents(): Promise<NormalizedHackathon[]> {
    if (!isSourceAuthorized(this.source)) {
      throw new Error("Devfolio access has not been authorized; connector remains disabled.");
    }

    const endpoint = "https://api.devfolio.co/api/hackathons?filter=all&page=1";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(endpoint, {
        headers: {
          "User-Agent": "PulsePoint-Aggregator/1.0 (+https://pulsepoint.app)",
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Devfolio responded with HTTP ${res.status}`);
      }

      const json = await res.json();
      if (!Array.isArray(json?.result)) {
        throw new Error("Devfolio response did not contain the expected event list.");
      }
      const list: DevfolioItem[] = json.result;

      const hackathons: NormalizedHackathon[] = [];
      let rejectedCount = 0;

      for (const item of list.slice(0, 30)) {
        if (!item.name || !item.slug) {
          rejectedCount++;
          continue;
        }

        const slug = generateCanonicalSlug(item.name);
        const mode: HackathonMode = item.is_online ? "Online" : "In Person";
        const officialUrl = `https://${item.slug}.devfolio.co`;

        const startIso = item.starts_at ? new Date(item.starts_at).toISOString() : undefined;
        const endIso = item.ends_at ? new Date(item.ends_at).toISOString() : undefined;
        // In Devfolio hackathons, registration closes right around starts_at
        const deadlineIso = startIso;

        const raw: Partial<NormalizedHackathon> = {
          id: `devfolio-${item.slug}`,
          slug,
          title: item.name,
          organizer: "Devfolio Community Organizer",
          source_platform: "Devfolio",
          source_url: officialUrl,
          apply_url: officialUrl,
          banner_url: item.banner_url || undefined,
          mode,
          location: item.location || (item.is_online ? "Online" : "In Person"),
          registration_status: calculateRegistrationStatus(deadlineIso),
          registration_deadline: deadlineIso,
          start_date: startIso,
          end_date: endIso,
          prize_pool: "See Devfolio Hackathon Page",
          prize_usd: 0,
          themes: ["Web3", "Blockchain", "Open Innovation", "AI/ML"],
          skills: ["Solidity", "Rust", "React", "TypeScript"],
          team_size_min: 1,
          team_size_max: 4,
          description: item.tagline || `${item.name} hosted on Devfolio. Register on the official portal.`,
          eligibility: "Open to students, collegiate builders, and developers.",
          featured: false,
          verified: true,
        };

        hackathons.push({
          ...(raw as NormalizedHackathon),
          sync_hash: computeSyncHash(raw),
        });
      }

      if (rejectedCount > 0) {
        console.warn(`[Aggregator:Devfolio] Skipped ${rejectedCount} records without a name or slug.`);
      }
      if (list.length > 0 && hackathons.length === 0) {
        throw new Error("Devfolio returned records, but none could be normalized.");
      }

      return hackathons;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Devfolio ingestion failed: ${msg}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
