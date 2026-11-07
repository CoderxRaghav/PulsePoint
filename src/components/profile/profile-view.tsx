"use client";

import React from "react";
import Image from "next/image";
import type { StudentProfile } from "@/lib/profile";

const categories = [
  "Programming languages",
  "Frontend",
  "Backend",
  "Databases",
  "AI/ML and data",
  "Design and other",
];

const panelClass = "rounded-2xl border border-white/[0.08] bg-[#12131b]/90 p-5 sm:p-6";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-100">
      {children}
    </span>
  );
}

interface ProfileViewProps {
  profile: StudentProfile;
  onEdit: () => void;
  completion: number;
}

export function ProfileView({ profile, onEdit, completion }: ProfileViewProps) {
  const initial = (profile.fullName || "S").slice(0, 1).toUpperCase();

  const links = [
    ["GitHub", profile.github],
    ["LinkedIn", profile.linkedin],
    ["Portfolio", profile.portfolio],
    ...profile.otherLinks.map((x) => ["Project", x]),
  ].filter((x): x is [string, string] => Boolean(x[1]));

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-5">
        {/* Profile Card Header */}
        <section className={panelClass}>
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-3xl font-semibold text-rose-200">
              {profile.photoUrl ? (
                <Image
                  src={profile.photoUrl}
                  alt={profile.fullName || "Profile photo"}
                  width={96}
                  height={96}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                initial
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold text-white">
                {profile.fullName || "Anonymous Student"}
              </h2>
              <p className="mt-1 text-sm text-neutral-400">
                {profile.headline || "Add a short headline in edit profile"}
              </p>
              <p className="mt-3 text-xs text-neutral-500">
                {[profile.degree, profile.branch, profile.college].filter(Boolean).join(" · ") ||
                  "Education details not yet specified"}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {[
                  profile.academicYear,
                  profile.graduationYear && `Class of ${profile.graduationYear}`,
                  profile.location,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>

            <button
              type="button"
              onClick={onEdit}
              className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 shadow-md shadow-rose-900/20"
            >
              Edit profile
            </button>
          </div>
        </section>

        {/* Skills Section */}
        <section className={panelClass}>
          <h3 className="mb-4 text-base font-semibold text-white">Skills & experience</h3>
          <div className="space-y-4">
            {categories
              .filter((cat) => profile.skills.some((s) => s.category === cat))
              .map((cat) => (
                <div key={cat}>
                  <p className="mb-2 text-xs font-medium text-neutral-500">{cat}</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills
                      .filter((s) => s.category === cat)
                      .map((s) => (
                        <Chip key={s.name}>
                          {s.name} <span className="text-rose-200/60">· {s.level}</span>
                        </Chip>
                      ))}
                  </div>
                </div>
              ))}
            {!profile.skills.length && (
              <p className="text-sm text-neutral-500">No skills added yet.</p>
            )}
          </div>
        </section>

        {/* Roles and Interests */}
        <div className="grid gap-5 md:grid-cols-2">
          <section className={panelClass}>
            <h3 className="mb-3 text-base font-semibold text-white">Preferred roles</h3>
            <div className="flex flex-wrap gap-2">
              {profile.roles.map((r) => (
                <Chip key={r}>{r}</Chip>
              ))}
            </div>
            {!profile.roles.length && (
              <p className="text-sm text-neutral-500">No roles selected yet.</p>
            )}
          </section>

          <section className={panelClass}>
            <h3 className="mb-3 text-base font-semibold text-white">Interests</h3>
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((item) => (
                <Chip key={item}>{item}</Chip>
              ))}
            </div>
            {!profile.interests.length && (
              <p className="text-sm text-neutral-500">No interests selected yet.</p>
            )}
          </section>
        </div>

        {/* What I Want to Build */}
        <section className={panelClass}>
          <h3 className="mb-3 text-base font-semibold text-white">What I want to build</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
            {profile.buildGoal || "Add a project goal to share what problems you want to solve."}
          </p>
        </section>

        {/* Availability & Collaboration */}
        <section className={panelClass}>
          <h3 className="mb-3 text-base font-semibold text-white">Availability & collaboration</h3>
          <div className="flex flex-wrap gap-2">
            {[profile.hoursPerWeek, profile.duration, ...profile.collaboration]
              .filter(Boolean)
              .map((item) => (
                <Chip key={item}>{item}</Chip>
              ))}
          </div>
          {!profile.hoursPerWeek && !profile.duration && !profile.collaboration.length && (
            <p className="text-sm text-neutral-500">Availability details are optional.</p>
          )}
        </section>

        {/* Links */}
        <section className={panelClass}>
          <h3 className="mb-3 text-base font-semibold text-white">Links</h3>
          <div className="flex flex-wrap gap-4 text-sm text-rose-200">
            {links.map(([label, url]) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition-colors"
              >
                {label} ↗
              </a>
            ))}
          </div>
          {!links.length && <p className="text-sm text-neutral-500">No links added yet.</p>}
        </section>
      </div>

      {/* Right Column Companion Status Panel */}
      <aside className={`${panelClass} h-fit`}>
        <h3 className="text-sm font-semibold text-white">Profile status</h3>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-rose-500 transition-all duration-300" style={{ width: `${completion}%` }} />
        </div>
        <p className="mt-2 text-xs text-neutral-400">{completion}% complete</p>

        <p className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-xs leading-relaxed text-neutral-300">
          {profile.visibleToStudents
            ? "Visible to signed-in PulsePoint students. Your email stays private."
            : "Only visible to you."}
        </p>
        <p className="mt-4 text-[11px] leading-relaxed text-neutral-500">
          Familiarity levels are self-assessments and have not been verified.
        </p>
      </aside>
    </div>
  );
}
