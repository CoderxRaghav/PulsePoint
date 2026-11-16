# Hackathon source access

PulsePoint treats external platforms and event organizers as the source of truth. This document tracks access approval; it is not an event catalog. No connector may fetch listings until its access is explicitly approved and its permitted API/feed, terms, and rate limits are recorded.

Robots.txt crawler directives and technically reachable endpoints do not establish an API license or permission to ingest event data. Do not scrape a source as a substitute for an API, RSS/ICS/JSON feed, partnership, or written authorization.

The global successful-sync cadence is 84 hours. Failed or partial attempts use a 15-minute retry cooldown so a provider outage does not block the rest of the catalog for several days or create a rapid retry loop.

| Source | Access state | Evidence / next step |
| --- | --- | --- |
| PulsePoint Curation (`Curated`) | Authorized (in-house) | Human-verified listings authored/published by allowlisted curators via `/api/admin/hackathons*` or the seed flow. Entries cite the official listing + registration URLs; no third-party feed permission is involved. Approval scope recorded 2026-11-16. |
| Unstop | Permission pending | A public listings endpoint responds, and `/api/public/*` is allowed in robots.txt; no public API license was verified. Confirm the endpoint's terms and permitted use with Unstop. |
| HackerEarth | Permission pending | The prototype references an upcoming-events JSON endpoint. Confirm API documentation, terms, and permitted use with HackerEarth. |
| Devfolio | Permission pending | The prototype references a JSON endpoint. Obtain official API/feed documentation or written authorization. |
| Hack2skill | Permission pending | The site and robots.txt are public; no API/feed permission was verified. Request an official feed or partnership. |
| Smart India Hackathon (SIH) | Permission pending | The official site publishes program information; no API/feed was verified. Request an official export/feed from the organizers. |
| MLH | Permission pending | The official event directory is public; no API/feed license was verified. Request authorized access before ingestion. |
| Devpost | Blocked without explicit authorization | Do not automate collection or crawl. Enable only after explicit authorization for a specific API/feed. |
| Universities, companies, and organizers | Permission pending per feed | Accept only documented, authorized RSS/ICS/JSON/API/partner feeds; retain attribution and official application links. |

No third-party event API provider is approved. Review and obtain user approval for pricing and licensing before evaluating or integrating a paid provider.

PulsePoint Curation (`Curated`, approved 2026-11-16, scope: catalog seeding and the student-suggestion publish flow) is authorized without third-party terms: every record is created or published by an allowlisted PulsePoint curator, cites the organizer's official listing and registration URLs, and is written to `hackathon_audit_log`. It is not an automated feed; enabling is handled by the curator workflow, not by connectors, and this approval does not authorize any scraping or third-party ingestion. Founder seeds verified events only.

## Approval requirements

Before changing a source to `authorized` in `src/lib/aggregator/source-policy.ts`, record:

- The exact official API/feed and the terms, written authorization, or partnership that permits this use.
- Required attribution, allowed fields, retention limits, rate limits, and refresh frequency.
- The source's official event and application URL formats and a fixture with unknown/optional data represented honestly.
- The date and scope of approval.

If permission is revoked or unclear, disable the connector. Never substitute manual event records or scraping.
