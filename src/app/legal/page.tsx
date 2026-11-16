import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PulsePoint — Privacy Notice & Community Guidelines",
  description:
    "What PulsePoint stores, what is public or private, how matching works, and how to request account deletion.",
};

const sections = [
  {
    id: "privacy",
    eyebrow: "Privacy Notice",
    title: "What PulsePoint stores, what is public, and your controls",
    body: [
      {
        heading: "What we collect — and why",
        items: [
          "Your Firebase account identity (UID, and email/name/photo from Google or GitHub if you use those providers). Used only to sign you in and attach your content to you.",
          "Your profile details you choose to add: headline, college, degree/year, skills, interests, goals, availability, and portfolio links. Used to show your profile to other students (per your visibility setting) and to rank teammate suggestions.",
          "Teams you create or join: membership, roles, join-request messages, and project briefs. Visible to other members of that team.",
          "Hackathon bookmarks and teams you follow. Used to power your personal saved list.",
        ],
      },
      {
        heading: "What is public vs. private",
        items: [
          "Your profile is visible to signed-in students only when your “Visible to students” setting is on. Turn it off any time and your profile disappears from discovery immediately.",
          "Member user IDs are not exposed to non-members; emails are never exposed in the app.",
          "Team join requests are private to the applicant and the team leader.",
          "Matching scores are computed from visible fields only. PulsePoint never infers or uses sensitive traits (religion, caste, health, politics, sexuality) and never scores personality.",
          "Feedback you give on suggestions (e.g. “Dismiss”) is private and used only to evaluate the matching algorithm.",
        ],
      },
      {
        heading: "How your data is stored",
        items: [
          "Passwords are handled entirely by Firebase Authentication; PulsePoint never sees or stores them.",
          "Profile, team, and bookmark data live in Supabase (PostgreSQL) with row-level security. Media (avatars, team logos) lives in Supabase Storage public buckets.",
          "PulsePoint has no advertising, no sale of personal data, and no third-party tracking or analytics pixels.",
        ],
      },
      {
        heading: "Hackathon listings",
        items: [
          "Listings are curated from sources PulsePoint is authorized to use. PulsePoint is not the organizer, and deadlines, prizes, and eligibility can change — always verify on the organizer’s official page before applying.",
          "If you spot a wrong listing, report it via GitHub Issues.",
        ],
      },
      {
        heading: "Deleting your account",
        items: [
          "In-app account deletion is not yet implemented. Until it ships, email your deletion request via GitHub Issues (see the repository link below) with your account email; we will delete your profile, memberships, and stored media.",
          "Deleting your profile stops you appearing in search/matching immediately.",
        ],
      },
    ],
  },
  {
    id: "guidelines",
    eyebrow: "Community Guidelines",
    title: "How we expect students to treat each other",
    body: [
      {
        heading: "House rules",
        items: [
          "Be honest about skills, availability, and commitments. Only list what is true.",
          "Respect every collaborator — any skill level, any college, any city.",
          "No harassment, discrimination, spam, or impersonation. Zero tolerance.",
          "Teams exist to build together: give feedback on ideas, not on people.",
        ],
      },
      {
        heading: "Respect the matching contract",
        items: [
          "Matches are suggestions from visible profile fields, not verdicts. It is fine to disagree with or dismiss a suggestion.",
          "Do not use discovery to spam students or harvest contact details.",
          "If you believe someone is abusing the platform, report them via GitHub Issues with the evidence you have.",
        ],
      },
      {
        heading: "Reporting & enforcement",
        items: [
          "Report via GitHub Issues: include the team or profile, what happened, and any evidence.",
          "Current enforcement is manual: we review reports and can disable accounts that violate these guidelines.",
          "A dedicated reporting flow ships with the trust & safety milestone.",
        ],
      },
    ],
  },
];

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)] px-4 py-12 sm:py-16">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
          ← Back to PulsePoint
        </Link>
        <h1 className="mt-6 font-serif text-3xl sm:text-4xl font-bold">Privacy Notice &amp; Community Guidelines</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Plain language, no legalese. This is the honest state of the product today — where a control is not built yet, we say so.
          Questions or corrections: open an issue at{" "}
          <a className="underline underline-offset-2 hover:text-[var(--foreground)]" href="https://github.com/CoderxRaghav/PulsePoint/issues" target="_blank" rel="noopener noreferrer">
            github.com/CoderxRaghav/PulsePoint/issues
          </a>.
        </p>

        {sections.map((section) => (
          <section key={section.id} id={section.id} className="mt-12 scroll-mt-8 border-t border-[var(--border)] pt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{section.eyebrow}</p>
            <h2 className="mt-2 font-serif text-2xl font-bold">{section.title}</h2>
            {section.body.map((block) => (
              <div key={block.heading} className="mt-6">
                <h3 className="font-semibold">{block.heading}</h3>
                <ul className="mt-2 list-disc pl-5 space-y-1.5 text-sm leading-6 text-[var(--muted)]">
                  {block.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
