"use client";

import React, { useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import type { User } from "firebase/auth";
import type { StudentProfile } from "@/lib/profile";

const roleOptions = [
  "Frontend developer",
  "Backend developer",
  "Full-stack developer",
  "AI/ML developer",
  "Data analyst",
  "UI/UX designer",
  "Researcher",
  "Product or presentation lead",
];

const categories = [
  "Programming languages",
  "Frontend",
  "Backend",
  "Databases",
  "AI/ML and data",
  "Design and other",
];

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#101117] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-rose-500/70 focus:ring-2 focus:ring-rose-500/20";
const panelClass = "rounded-2xl border border-white/[0.08] bg-[#12131b]/90 p-5 sm:p-6";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-neutral-200">{label}</span>
      {children}
      {hint && <span className="block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

function Chip({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-100">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${children}`}
          className="text-rose-300 hover:text-white"
        >
          ×
        </button>
      )}
    </span>
  );
}

function PanelTitle({
  number,
  title,
  note,
}: {
  number: string;
  title: string;
  note: string;
}) {
  return (
    <div className="mb-5 flex gap-3">
      <span className="pt-0.5 font-mono text-xs text-rose-300">{number}</span>
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <p className="mt-1 text-xs text-neutral-500">{note}</p>
      </div>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-neutral-300">{value}</p>
    </div>
  );
}

interface ProfileFormProps {
  profile: StudentProfile;
  user: User;
  saving: boolean;
  completion: number;
  errors: Record<string, string>;
  patchProfile: (patch: Partial<StudentProfile>) => void;
  onSave: (complete: boolean) => Promise<void>;
  photoPreview: string;
  onPhotoSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  onPhotoRemoved: () => void;
}

export function ProfileForm({
  profile,
  user,
  saving,
  completion,
  errors,
  patchProfile,
  onSave,
  photoPreview,
  onPhotoSelected,
  onPhotoRemoved,
}: ProfileFormProps) {
  const [skillName, setSkillName] = useState("");
  const [skillCategory, setSkillCategory] = useState(categories[0]);
  const [skillLevel, setSkillLevel] = useState("Comfortable");
  const [roleInput, setRoleInput] = useState("");
  const [interestInput, setInterestInput] = useState("");
  const [preview, setPreview] = useState(false);

  const toggle = (
    values: string[],
    value: string,
    update: (values: string[]) => void,
  ) => update(values.includes(value) ? values.filter((x) => x !== value) : [...values, value]);

  const addListValue = (field: "roles" | "interests", value: string) => {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (!normalized) return;
    const existing = profile[field];
    if (!existing.some((entry) => entry.toLowerCase() === normalized.toLowerCase())) {
      patchProfile({ [field]: [...existing, normalized] });
    }
    if (field === "roles") setRoleInput("");
    else setInterestInput("");
  };

  const addSkill = () => {
    const name = skillName.trim().replace(/\s+/g, " ");
    if (!name || profile.skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      return;
    }
    patchProfile({
      skills: [...profile.skills, { name, category: skillCategory, level: skillLevel }],
    });
    setSkillName("");
  };

  const textField = (
    label: string,
    key: keyof StudentProfile,
    placeholder = "",
    required = false,
  ) => (
    <Field label={`${label}${required ? " *" : ""}`}>
      <input
        className={inputClass}
        value={String(profile[key] ?? "")}
        placeholder={placeholder}
        onChange={(e) => patchProfile({ [key]: e.target.value } as Partial<StudentProfile>)}
        aria-invalid={Boolean(errors[key])}
      />
      {errors[key] && <span className="block text-xs text-rose-300">{errors[key]}</span>}
    </Field>
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void onSave(true);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6 flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#12131b] p-4">
        <div>
          <p className="text-sm font-semibold text-white">Profile completion</p>
          <p className="mt-0.5 text-xs text-neutral-500">Optional details can always be skipped.</p>
        </div>
        <span className="text-lg font-bold text-rose-300">{completion}%</span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          {/* 01 Photo & Basics */}
          <section className={panelClass}>
            <PanelTitle
              number="01"
              title="Photo & basics"
              note="Start with the details teammates need to know."
            />
            <div className="mb-6 flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-2xl font-semibold text-rose-200">
                {photoPreview ? (
                  <Image
                    src={photoPreview}
                    alt="Profile preview"
                    width={80}
                    height={80}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (profile.fullName || user.displayName || "S").slice(0, 1).toUpperCase()
                )}
              </div>
              <div>
                <label className="inline-flex cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium hover:bg-white/10 transition">
                  {photoPreview ? "Replace photo" : "Choose photo"}
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={onPhotoSelected}
                  />
                </label>
                {photoPreview && (
                  <button
                    type="button"
                    className="ml-3 text-xs text-neutral-400 hover:text-white"
                    onClick={onPhotoRemoved}
                  >
                    Remove
                  </button>
                )}
                <p className="mt-2 text-xs text-neutral-500">
                  JPG, PNG, WebP, or GIF · up to 5 MB. Stored securely on Supabase Storage.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Firebase account email">
                <input
                  className={`${inputClass} opacity-70`}
                  type="email"
                  value={user.email ?? ""}
                  readOnly
                  aria-readonly="true"
                />
              </Field>
              {textField("Full name", "fullName", "Your name", true)}
              {textField("Short headline", "headline", "CSE student interested in backend development")}
              {textField("College or university", "college", "University name", true)}
              {textField("Degree", "degree", "B.Tech, B.Sc, …", true)}
              {textField("Branch or department", "branch", "Computer Science", true)}
              <Field label="Current academic year *">
                <select
                  className={inputClass}
                  value={profile.academicYear}
                  onChange={(e) => patchProfile({ academicYear: e.target.value })}
                  aria-invalid={Boolean(errors.academicYear)}
                >
                  <option value="">Choose year</option>
                  {[
                    "1st year",
                    "2nd year",
                    "3rd year",
                    "4th year",
                    "5th year",
                    "Graduate student",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                {errors.academicYear && (
                  <span className="block text-xs text-rose-300">{errors.academicYear}</span>
                )}
              </Field>
              {textField("Expected graduation year", "graduationYear", "2027")}
              {textField("City or region", "location", "Optional")}
            </div>
          </section>

          {/* 02 Skills & Experience */}
          <section className={panelClass}>
            <PanelTitle
              number="02"
              title="Skills & experience"
              note="Skill levels are your own self-assessment, not verified ratings."
            />
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_150px_auto]">
              <input
                className={inputClass}
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                placeholder="Add a skill"
                aria-label="Skill name"
              />
              <select
                className={inputClass}
                value={skillCategory}
                onChange={(e) => setSkillCategory(e.target.value)}
              >
                {categories.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <select
                className={inputClass}
                value={skillLevel}
                onChange={(e) => setSkillLevel(e.target.value)}
              >
                {["Beginner", "Comfortable", "Experienced"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={addSkill}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 transition"
              >
                Add
              </button>
            </div>
            {errors.skills && <p className="mt-3 text-xs text-rose-300">{errors.skills}</p>}

            <div className="mt-4 space-y-3">
              {categories.map((cat) => (
                <div key={cat}>
                  <p className="mb-2 text-xs font-medium text-neutral-500">{cat}</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills
                      .filter((s) => s.category === cat)
                      .map((skill, i) => (
                        <Chip
                          key={`${skill.name}-${i}`}
                          onRemove={() =>
                            patchProfile({ skills: profile.skills.filter((x) => x !== skill) })
                          }
                        >
                          {skill.name} <span className="text-rose-200/60">· {skillLevel}</span>
                        </Chip>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 03 Preferred Team Roles */}
          <section className={panelClass}>
            <PanelTitle
              number="03"
              title="Preferred team roles"
              note="Choose more than one, or add a role that fits you."
            />
            <div className="flex flex-wrap gap-2">
              {roleOptions.map((role) => (
                <button
                  type="button"
                  key={role}
                  onClick={() => toggle(profile.roles, role, (roles) => patchProfile({ roles }))}
                  className={`rounded-full border px-3 py-2 text-xs transition ${
                    profile.roles.includes(role)
                      ? "border-rose-400/40 bg-rose-500/15 text-rose-100"
                      : "border-white/10 text-neutral-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                className={inputClass}
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addListValue("roles", roleInput))
                }
                placeholder="Add another role"
              />
              <button
                type="button"
                onClick={() => addListValue("roles", roleInput)}
                className="rounded-xl border border-white/10 px-4 text-sm font-medium hover:bg-white/5 transition"
              >
                Add
              </button>
            </div>
            {errors.roles && <p className="mt-3 text-xs text-rose-300">{errors.roles}</p>}
            {profile.roles.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.roles.map((r) => (
                  <Chip
                    key={r}
                    onRemove={() =>
                      patchProfile({ roles: profile.roles.filter((x) => x !== r) })
                    }
                  >
                    {r}
                  </Chip>
                ))}
              </div>
            )}
          </section>

          {/* 04 Interests & Project Goals */}
          <section className={panelClass}>
            <PanelTitle
              number="04"
              title="Interests & project goals"
              note="Help future teammates understand what excites you."
            />
            <div className="flex flex-wrap gap-2">
              {[
                "Education",
                "Sustainability",
                "Health",
                "Finance",
                "Developer tools",
                "Community",
                "Accessibility",
                "Creative tech",
              ].map((interest) => (
                <button
                  type="button"
                  key={interest}
                  onClick={() =>
                    toggle(profile.interests, interest, (interests) => patchProfile({ interests }))
                  }
                  className={`rounded-full border px-3 py-2 text-xs transition ${
                    profile.interests.includes(interest)
                      ? "border-rose-400/40 bg-rose-500/15 text-rose-100"
                      : "border-white/10 text-neutral-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {interest}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                className={inputClass}
                value={interestInput}
                onChange={(e) => setInterestInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  (e.preventDefault(), addListValue("interests", interestInput))
                }
                placeholder="Add an interest"
              />
              <button
                type="button"
                onClick={() => addListValue("interests", interestInput)}
                className="rounded-xl border border-white/10 px-4 text-sm font-medium hover:bg-white/5 transition"
              >
                Add
              </button>
            </div>
            {errors.interests && <p className="mt-3 text-xs text-rose-300">{errors.interests}</p>}
            {profile.interests.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.interests.map((x) => (
                  <Chip
                    key={x}
                    onRemove={() =>
                      patchProfile({ interests: profile.interests.filter((y) => y !== x) })
                    }
                  >
                    {x}
                  </Chip>
                ))}
              </div>
            )}

            <div className="mt-5">
              <Field label="What I want to build *">
                <textarea
                  className={`${inputClass} min-h-24 resize-y`}
                  maxLength={500}
                  value={profile.buildGoal}
                  onChange={(e) => patchProfile({ buildGoal: e.target.value })}
                  placeholder="A simple idea or the kind of problem you want to solve…"
                  aria-invalid={Boolean(errors.buildGoal)}
                />
              </Field>
              {errors.buildGoal && (
                <span className="block mt-1 text-xs text-rose-300">{errors.buildGoal}</span>
              )}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Project experience links"
                hint="Optional links to past work, one URL per line."
              >
                <textarea
                  className={`${inputClass} min-h-20`}
                  value={profile.experienceLinks.join("\n")}
                  onChange={(e) =>
                    patchProfile({
                      experienceLinks: e.target.value
                        .split("\n")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="https://…"
                />
              </Field>
              <Field label="Other project links" hint={errors.otherLinks}>
                <textarea
                  className={`${inputClass} min-h-20`}
                  value={profile.otherLinks.join("\n")}
                  onChange={(e) =>
                    patchProfile({
                      otherLinks: e.target.value
                        .split("\n")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="https://…"
                />
              </Field>
            </div>
          </section>

          {/* 05 Availability & Collaboration */}
          <section className={panelClass}>
            <PanelTitle
              number="05"
              title="Availability & collaboration"
              note="Let teammates know when and how you can work together."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Approximate hours per week *">
                <select
                  className={inputClass}
                  value={profile.hoursPerWeek}
                  onChange={(e) => patchProfile({ hoursPerWeek: e.target.value })}
                  aria-invalid={Boolean(errors.hoursPerWeek)}
                >
                  <option value="">Choose availability</option>
                  {["1–3 hours", "4–6 hours", "7–10 hours", "10+ hours", "Flexible"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                {errors.hoursPerWeek && (
                  <span className="block text-xs text-rose-300">{errors.hoursPerWeek}</span>
                )}
              </Field>
              <Field label="Project duration or window">
                <input
                  className={inputClass}
                  value={profile.duration}
                  onChange={(e) => patchProfile({ duration: e.target.value })}
                  placeholder="e.g. Summer break, 6 weeks"
                />
              </Field>
            </div>

            <p className="mb-2 mt-4 text-sm font-medium text-neutral-200">
              Collaboration preferences
            </p>
            <div className="flex flex-wrap gap-2">
              {["Remote", "In person", "Async", "Scheduled meetings", "Flexible"].map((x) => (
                <button
                  type="button"
                  key={x}
                  onClick={() =>
                    toggle(profile.collaboration, x, (collaboration) =>
                      patchProfile({ collaboration }),
                    )
                  }
                  className={`rounded-full border px-3 py-2 text-xs transition ${
                    profile.collaboration.includes(x)
                      ? "border-rose-400/40 bg-rose-500/15 text-rose-100"
                      : "border-white/10 text-neutral-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {x}
                </button>
              ))}
            </div>
          </section>

          {/* 06 Links & Visibility */}
          <section className={panelClass}>
            <PanelTitle
              number="06"
              title="Links & visibility"
              note="Your email and private contact details stay private."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {textField("GitHub", "github", "https://github.com/username")}
              {textField("LinkedIn", "linkedin", "https://linkedin.com/in/username")}
              {textField("Portfolio", "portfolio", "https://…")}
            </div>

            <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={profile.visibleToStudents}
                  onChange={(e) => patchProfile({ visibleToStudents: e.target.checked })}
                  className="mt-1 accent-rose-500"
                />
                <span>
                  <span className="block text-sm font-medium text-white">
                    Show my profile to signed-in PulsePoint students
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-neutral-400">
                    When enabled, students can see the profile details you share here. Your email
                    remains private. Turn this off to keep your profile visible only to you.
                  </span>
                </span>
              </label>
            </div>
          </section>
        </div>

        {/* Right Sticky Companion Preview Card */}
        <aside className="space-y-4">
          <div className={`${panelClass} sticky top-5`}>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-rose-300">
              Preview
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">How teammates see you</h3>
            <p className="mt-1 text-xs text-neutral-500">Your email is always private.</p>

            <div className="my-5 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5 text-lg font-semibold text-rose-200">
                {photoPreview ? (
                  <Image
                    src={photoPreview}
                    alt=""
                    width={48}
                    height={48}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (profile.fullName || "S").slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {profile.fullName || "Your name"}
                </p>
                <p className="truncate text-xs text-neutral-400">
                  {profile.headline || "Your headline"}
                </p>
              </div>
            </div>

            <div className="space-y-4 border-t border-white/[0.07] pt-4 text-sm">
              <PreviewRow
                label="Education"
                value={
                  [profile.degree, profile.branch, profile.college].filter(Boolean).join(" · ") ||
                  "Add your education"
                }
              />
              <PreviewRow
                label="Roles"
                value={profile.roles.join(", ") || "Choose preferred roles"}
              />
              <PreviewRow
                label="Skills"
                value={
                  profile.skills
                    .slice(0, 5)
                    .map((s) => s.name)
                    .join(", ") || "Add skills"
                }
              />
              <PreviewRow
                label="Interests"
                value={profile.interests.join(", ") || "Add interests"}
              />
            </div>

            <button
              type="button"
              onClick={() => setPreview(!preview)}
              className="mt-5 w-full rounded-xl border border-white/10 py-2.5 text-sm font-medium hover:bg-white/5 transition"
            >
              {preview ? "Close full preview" : "Preview profile"}
            </button>

            {preview && (
              <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] p-4 text-sm">
                <p className="font-semibold text-white">{profile.fullName || "Your name"}</p>
                <p className="mt-1 text-neutral-300">
                  {profile.headline || "Your headline will appear here."}
                </p>
                <p className="mt-3 text-xs text-neutral-400">
                  {profile.buildGoal || "Your project goal will appear here."}
                </p>
              </div>
            )}

            <div className="mt-5 grid gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-900/20 transition hover:bg-rose-500 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save profile"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void onSave(false)}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-neutral-300 hover:bg-white/5 transition disabled:opacity-60"
              >
                Save draft
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-neutral-500">
              Saved to your Supabase profile.
            </p>
          </div>
        </aside>
      </div>
    </form>
  );
}
