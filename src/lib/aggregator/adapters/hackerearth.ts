import { AggregatorAdapter, NormalizedHackathon } from "../types";
import { isSourceAuthorized } from "../source-policy";
import { generateCanonicalSlug, computeSyncHash, calculateRegistrationStatus } from "../deduplication";

interface HackerEarthEvent {
  id?: string;
  title?: string;
  url?: string;
  start_tz?: string;
  end_tz?: string;
  start_utc?: string;
  end_utc?: string;
  cover_image?: string;
  thumbnail?: string;
  challenge_type?: string;
  description?: string;
}

export class HackerEarthAdapter implements AggregatorAdapter {
  source = "HackerEarth" as const;

  async fetchEvents(): Promise<NormalizedHackathon[]> {
    if (!isSourceAuthorized(this.source)) {
      throw new Error("HackerEarth access has not been authorized; connector remains disabled.");
    }

    const endpoint = "https://www.hackerearth.com/api/events/upcoming/?format=json";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(endpoint, {
        headers: {
          "User-Agent": "PulsePoint-Aggregator/1.0 (Collegiate Student Platform; +https://github.com/CoderxRaghav/PulsePoint)",
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HackerEarth responded with HTTP ${res.status}`);
      }

      let data = await res.json();
      if (typeof data === "string") {
        try {
          const jsonCompatible = data
            .replace(/:\s*False/g, ": false")
            .replace(/:\s*True/g, ": true")
            .replace(/:\s*None/g, ": null");
          const fn = new Function("return (" + jsonCompatible + ")");
          data = fn();
        } catch {
          // Fall through to validation check below
        }
      }

      if (!Array.isArray(data?.response)) {
        throw new Error("HackerEarth response did not contain the expected event list.");
      }
      const responseEvents: HackerEarthEvent[] = data.response;

      const hackathons: NormalizedHackathon[] = [];
      let rejectedCount = 0;

      for (const item of responseEvents) {
        if (!item.title || !item.url) {
          rejectedCount++;
          continue;
        }

        const slug = generateCanonicalSlug(item.title);
        const deadlineIso = item.end_utc ? new Date(item.end_utc).toISOString() : undefined;
        const startIso = item.start_utc ? new Date(item.start_utc).toISOString() : undefined;

        const raw: Partial<NormalizedHackathon> = {
          id: `hackerearth-${item.id || slug}`,
          slug,
          title: item.title,
          organizer: "HackerEarth Partner Network",
          source_platform: "HackerEarth",
          source_url: item.url,
          apply_url: item.url,
          banner_url: item.cover_image || item.thumbnail || undefined,
          mode: "Online",
          location: "Worldwide (Online)",
          registration_status: calculateRegistrationStatus(deadlineIso),
          registration_deadline: deadlineIso,
          start_date: startIso,
          end_date: deadlineIso,
          prize_pool: "See official challenge page",
          prize_usd: 0,
          themes: ["Competitive Programming", "AI/ML", "Web Development"],
          skills: ["Algorithms", "Python", "Problem Solving"],
          team_size_min: 1,
          team_size_max: 3,
          description: item.description || `${item.title} hosted on HackerEarth. Open for registration.`,
          eligibility: "Open to developers and students worldwide.",
          featured: false,
          verified: true,
        };

        hackathons.push({
          ...(raw as NormalizedHackathon),
          sync_hash: computeSyncHash(raw),
        });
      }

      if (rejectedCount > 0) {
        console.warn(`[Aggregator:HackerEarth] Skipped ${rejectedCount} records without a title or URL.`);
      }
      if (responseEvents.length > 0 && hackathons.length === 0) {
        throw new Error("HackerEarth returned records, but none could be normalized.");
      }

      return hackathons;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`HackerEarth ingestion failed: ${msg}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
