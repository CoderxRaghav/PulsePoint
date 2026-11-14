import { AggregatorAdapter, NormalizedHackathon, HackathonMode } from "../types";
import { isSourceAuthorized } from "../source-policy";
import { generateCanonicalSlug, computeSyncHash, calculateRegistrationStatus } from "../deduplication";

interface MLHEventRaw {
  name: string;
  url: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  imageUrl?: string;
  mode?: string;
}

export class MLHAdapter implements AggregatorAdapter {
  source = "MLH" as const;

  async fetchEvents(): Promise<NormalizedHackathon[]> {
    if (!isSourceAuthorized(this.source)) {
      throw new Error("MLH access has not been authorized; connector remains disabled.");
    }
    // Official MLH Season listings published in open developer feeds
    const endpoint = "https://raw.githubusercontent.com/MLH/mlh-hackathon-flask-starter/master/hackathons.json";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(endpoint, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`MLH feed responded with HTTP ${res.status}`);
      }

      const responseList = await res.json();
      if (!Array.isArray(responseList)) {
        throw new Error("MLH feed did not contain the expected event list.");
      }
      const list: MLHEventRaw[] = responseList;
      const hackathons: NormalizedHackathon[] = [];
      let rejectedCount = 0;

      for (const item of list.slice(0, 30)) {
        if (!item.name || !item.url) {
          rejectedCount++;
          continue;
        }

        const slug = generateCanonicalSlug(item.name);
        const isDigital = (item.location || "").toLowerCase().includes("digital") || (item.location || "").toLowerCase().includes("online");
        const mode: HackathonMode = isDigital ? "Online" : "In Person";

        const startIso = item.startDate ? new Date(item.startDate).toISOString() : undefined;
        const endIso = item.endDate ? new Date(item.endDate).toISOString() : undefined;

        const raw: Partial<NormalizedHackathon> = {
          id: `mlh-${slug}`,
          slug,
          title: item.name,
          organizer: "Major League Hacking Member Event",
          source_platform: "MLH",
          source_url: item.url,
          apply_url: item.url,
          banner_url: item.imageUrl || undefined,
          mode,
          location: item.location || "Collegiate Campus",
          registration_status: calculateRegistrationStatus(startIso),
          registration_deadline: startIso,
          start_date: startIso,
          end_date: endIso,
          prize_pool: "MLH Medals & Sponsor Tracks",
          prize_usd: 0,
          themes: ["Collegiate", "Open Innovation", "Web Development", "AI/ML"],
          skills: ["Python", "JavaScript", "React", "Mobile"],
          team_size_min: 2,
          team_size_max: 4,
          description: `${item.name} is an official Major League Hacking collegiate hackathon. Build over a weekend with mentors, workshops, and hardware.`,
          eligibility: "Currently enrolled collegiate, high school, or university students.",
          featured: true,
          verified: true,
        };

        hackathons.push({
          ...(raw as NormalizedHackathon),
          sync_hash: computeSyncHash(raw),
        });
      }

      if (rejectedCount > 0) {
        console.warn(`[Aggregator:MLH] Skipped ${rejectedCount} records without a name or URL.`);
      }
      if (list.length > 0 && hackathons.length === 0) {
        throw new Error("MLH returned records, but none could be normalized.");
      }

      return hackathons;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`MLH ingestion failed: ${msg}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
