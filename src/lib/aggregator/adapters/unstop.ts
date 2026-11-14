import { AggregatorAdapter, NormalizedHackathon } from "../types";
import { isSourceAuthorized } from "../source-policy";
import { generateCanonicalSlug, computeSyncHash, calculateRegistrationStatus } from "../deduplication";

interface UnstopItem {
  id?: number | string;
  title?: string;
  organisation?: { name?: string };
  banner_mobile?: { image_url?: string };
  regnRequirements?: { end_regn_dt?: string; start_regn_dt?: string };
  prizes?: { cash?: number };
  seo_url?: string;
}

export class UnstopAdapter implements AggregatorAdapter {
  source = "Unstop" as const;

  async fetchEvents(): Promise<NormalizedHackathon[]> {
    if (!isSourceAuthorized(this.source)) {
      throw new Error("Unstop access has not been authorized; connector remains disabled.");
    }

    const endpoint = "https://unstop.com/api/public/opportunity/search-result?opportunity=hackathons&per_page=20";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(endpoint, {
        headers: {
          "User-Agent": "PulsePoint-StudentHub/1.0 (+https://github.com/CoderxRaghav/PulsePoint)",
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Unstop responded with HTTP ${res.status}`);
      }

      const json = await res.json();
      const responseList = json?.data?.data;
      if (!Array.isArray(responseList)) {
        throw new Error("Unstop response did not contain the expected event list.");
      }
      const list: UnstopItem[] = responseList;

      const hackathons: NormalizedHackathon[] = [];
      let rejectedCount = 0;

      for (const item of list.slice(0, 25)) {
        if (!item.title) {
          rejectedCount++;
          continue;
        }

        const slug = generateCanonicalSlug(item.title);
        const officialUrl = item.seo_url
          ? (item.seo_url.startsWith("http") ? item.seo_url : `https://unstop.com/${item.seo_url}`)
          : `https://unstop.com/hackathons/${slug}`;

        const deadlineIso = item.regnRequirements?.end_regn_dt
          ? new Date(item.regnRequirements.end_regn_dt).toISOString()
          : undefined;
        const startIso = item.regnRequirements?.start_regn_dt
          ? new Date(item.regnRequirements.start_regn_dt).toISOString()
          : undefined;

        const cashPrize = item.prizes?.cash || 0;
        const prizePool = cashPrize > 0 ? `₹${cashPrize.toLocaleString()}` : "Certificates & Prizes";

        const raw: Partial<NormalizedHackathon> = {
          id: `unstop-${item.id || slug}`,
          slug,
          title: item.title,
          organizer: item.organisation?.name || "Unstop Academic Partner",
          source_platform: "Unstop",
          source_url: officialUrl,
          apply_url: officialUrl,
          banner_url: item.banner_mobile?.image_url || undefined,
          mode: "Online",
          location: "India / Hybrid (Online)",
          registration_status: calculateRegistrationStatus(deadlineIso),
          registration_deadline: deadlineIso,
          start_date: startIso,
          end_date: deadlineIso,
          prize_pool: prizePool,
          prize_usd: cashPrize > 0 ? Math.round(cashPrize / 86) : 0,
          themes: ["Open Innovation", "Engineering", "Software", "AI/ML"],
          skills: ["Problem Solving", "Web Development", "AI/ML", "Presentation"],
          team_size_min: 1,
          team_size_max: 4,
          description: `${item.title} organized by ${item.organisation?.name || "Unstop Partner"}. Official registrations open on Unstop.`,
          eligibility: "Engineering and college students across India and globally.",
          featured: false,
          verified: true,
        };

        hackathons.push({
          ...(raw as NormalizedHackathon),
          sync_hash: computeSyncHash(raw),
        });
      }

      if (rejectedCount > 0) {
        console.warn(`[Aggregator:Unstop] Skipped ${rejectedCount} records without a title.`);
      }
      if (list.length > 0 && hackathons.length === 0) {
        throw new Error("Unstop returned records, but none could be normalized.");
      }

      return hackathons;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Unstop ingestion failed: ${msg}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
