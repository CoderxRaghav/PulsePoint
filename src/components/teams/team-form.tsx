"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import {
  TEAM_CATEGORIES,
  TEAM_COLLABORATION_OPTIONS,
  TEAM_DOMAINS,
  TEAM_EXPERIENCE_LEVELS,
  TEAM_ROLES,
  TEAM_SKILL_OPTIONS,
  TEAM_STAGES,
  TEAM_TECHNOLOGY_OPTIONS,
  type TeamSummary,
} from "@/lib/team-types";
import { uploadTeamLogo } from "@/lib/team-client";

export interface TeamFormPayload {
  team: {
    team_name: string;
    description: string;
    college: string;
    max_members: number;
    positions_open: number;
    recruitment_status: "open" | "closed";
    experience_level: string;
    beginner_friendly: boolean;
    collaboration_preferences: string[];
    hackathon_name: string;
    logo_url: string;
  };
  project: {
    project_name: string;
    description: string;
    problem_statement: string;
    objectives: string[];
    domain: string;
    category: string;
    development_stage: string;
    technologies: string[];
    github_url: string;
    demo_url: string;
  };
  requiredSkills: Array<{ skill_name: string; positions_required: number; preferred_role: string }>;
}

interface TeamFormProps {
  user: User;
  initial?: TeamSummary;
  onSubmit: (payload: TeamFormPayload) => Promise<void>;
  submitLabel: string;
  submitting: boolean;
  error?: string;
}

const fieldClass = "mt-1 w-full rounded-xl border border-charcoal-700 bg-space-black px-3.5 py-3 text-sm text-warm-white outline-none transition placeholder:text-warm-white-muted/70 focus:border-crimson focus:ring-2 focus:ring-crimson/15";
const labelClass = "block text-sm font-medium text-warm-white";
const sectionClass = "rounded-2xl border border-charcoal-700 bg-charcoal-900 p-5 sm:p-7";

function makeInitial(initial?: TeamSummary): TeamFormPayload {
  if (!initial) {
    return {
      team: {
        team_name: "", description: "", college: "", max_members: 4, positions_open: 3,
        recruitment_status: "open", experience_level: "Any", beginner_friendly: true,
        collaboration_preferences: ["Remote", "Flexible"], hackathon_name: "", logo_url: "",
      },
      project: {
        project_name: "", description: "", problem_statement: "", objectives: [""],
        domain: TEAM_DOMAINS[0], category: TEAM_CATEGORIES[0], development_stage: "Idea",
        technologies: [], github_url: "", demo_url: "",
      },
      requiredSkills: [{ skill_name: "", positions_required: 1, preferred_role: TEAM_ROLES[0] }],
    };
  }
  return {
    team: {
      team_name: initial.team_name,
      description: initial.description,
      college: initial.college,
      max_members: initial.max_members,
      positions_open: initial.positions_open,
      recruitment_status: initial.recruitment_status,
      experience_level: initial.experience_level,
      beginner_friendly: initial.beginner_friendly,
      collaboration_preferences: initial.collaboration_preferences,
      hackathon_name: initial.hackathon_name || "",
      logo_url: initial.logo_url || "",
    },
    project: {
      ...initial.project,
      objectives: initial.project.objectives.length ? initial.project.objectives : [""],
      github_url: initial.project.github_url || "",
      demo_url: initial.project.demo_url || "",
    },
    requiredSkills: initial.required_skills.map(({ skill_name, positions_required, preferred_role }) => ({
      skill_name, positions_required, preferred_role,
    })),
  };
}

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function TeamForm({ user, initial, onSubmit, submitLabel, submitting, error }: TeamFormProps) {
  const [form, setForm] = useState(() => makeInitial(initial));
  const [customSkill, setCustomSkill] = useState("");
  const [customTechnology, setCustomTechnology] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [validationError, setValidationError] = useState("");

  const patchTeam = (patch: Partial<TeamFormPayload["team"]>) =>
    setForm((current) => ({ ...current, team: { ...current.team, ...patch } }));
  const patchProject = (patch: Partial<TeamFormPayload["project"]>) =>
    setForm((current) => ({ ...current, project: { ...current.project, ...patch } }));

  const onLogoSelected = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setLogoError("Choose a JPG, PNG, WebP, or GIF image under 5 MB.");
      return;
    }
    setLogoBusy(true);
    setLogoError("");
    try {
      patchTeam({ logo_url: await uploadTeamLogo(user, file) });
    } catch (uploadError) {
      setLogoError(uploadError instanceof Error ? uploadError.message : "Logo upload failed.");
    } finally {
      setLogoBusy(false);
    }
  };

  const addCustomSkill = () => {
    const skill = customSkill.trim();
    if (!skill || form.requiredSkills.some((item) => item.skill_name.toLowerCase() === skill.toLowerCase())) return;
    setForm((current) => ({
      ...current,
      requiredSkills: [...current.requiredSkills, { skill_name: skill, positions_required: 1, preferred_role: "Other" }],
    }));
    setCustomSkill("");
  };

  const addTechnology = () => {
    const technology = customTechnology.trim();
    if (!technology || form.project.technologies.some((item) => item.toLowerCase() === technology.toLowerCase())) return;
    patchProject({ technologies: [...form.project.technologies, technology] });
    setCustomTechnology("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError("");
    const objectives = form.project.objectives.map((item) => item.trim()).filter(Boolean);
    const skills = form.requiredSkills.filter((item) => item.skill_name.trim());
    if (form.team.positions_open > form.team.max_members - (initial?.member_count || 1)) {
      setValidationError("Available positions cannot exceed the remaining team capacity.");
      return;
    }
    if (!objectives.length) {
      setValidationError("Add at least one project objective.");
      return;
    }
    if (!skills.length) {
      setValidationError("Add at least one required skill and preferred role.");
      return;
    }
    await onSubmit({ ...form, project: { ...form.project, objectives }, requiredSkills: skills });
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className={sectionClass}>
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-crimson">Team setup</p>
          <h2 className="team-heading mt-2 text-2xl font-bold text-warm-white">Your team</h2>
          <p className="mt-2 text-sm text-warm-white-muted">You will be set as the team lead and first member automatically.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <label className={labelClass}>Team name
            <input required minLength={2} maxLength={100} value={form.team.team_name} onChange={(event) => patchTeam({ team_name: event.target.value })} className={fieldClass} placeholder="e.g. Campus Climate Lab" />
          </label>
          <label className={labelClass}>College or university
            <input required minLength={2} maxLength={160} value={form.team.college} onChange={(event) => patchTeam({ college: event.target.value })} className={fieldClass} placeholder="Your institution" />
          </label>
          <label className={`${labelClass} md:col-span-2`}>Team description
            <textarea required minLength={10} maxLength={2000} rows={3} value={form.team.description} onChange={(event) => patchTeam({ description: event.target.value })} className={fieldClass} placeholder="What kind of team are you building?" />
          </label>
          <label className={labelClass}>Maximum team size
            <input required type="number" min={2} max={50} value={form.team.max_members} onChange={(event) => patchTeam({ max_members: Number(event.target.value) })} className={fieldClass} />
          </label>
          <label className={labelClass}>Positions currently open
            <input required type="number" min={0} max={49} value={form.team.positions_open} onChange={(event) => patchTeam({ positions_open: Number(event.target.value) })} className={fieldClass} />
          </label>
          <label className={labelClass}>Recruitment status
            <select value={form.team.recruitment_status} onChange={(event) => patchTeam({ recruitment_status: event.target.value as "open" | "closed" })} className={fieldClass}>
              <option value="open">Open to requests</option><option value="closed">Closed</option>
            </select>
          </label>
          <label className={labelClass}>Experience level
            <select value={form.team.experience_level} onChange={(event) => patchTeam({ experience_level: event.target.value })} className={fieldClass}>
              {TEAM_EXPERIENCE_LEVELS.map((level) => <option key={level}>{level}</option>)}
            </select>
          </label>
          <label className={labelClass}>Hackathon (optional)
            <input maxLength={160} value={form.team.hackathon_name} onChange={(event) => patchTeam({ hackathon_name: event.target.value })} className={fieldClass} placeholder="Event or challenge name" />
          </label>
          <div className={labelClass}>
            Team logo (optional)
            <div className="mt-1 flex flex-wrap items-center gap-3">
              {form.team.logo_url && <Image src={form.team.logo_url} alt="Team logo preview" width={48} height={48} unoptimized className="h-12 w-12 rounded-xl object-cover" />}
              <label className="cursor-pointer rounded-xl border border-charcoal-700 px-3 py-2 text-sm text-warm-white transition hover:bg-charcoal-800">
                {logoBusy ? "Uploading…" : "Choose image"}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={logoBusy} onChange={(event) => void onLogoSelected(event.target.files?.[0])} />
              </label>
              {form.team.logo_url && <button type="button" onClick={() => patchTeam({ logo_url: "" })} className="text-sm text-crimson hover:underline">Remove</button>}
            </div>
            {logoError && <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-300">{logoError}</p>}
          </div>
        </div>
        <div className="mt-5">
          <p className={labelClass}>Collaboration preferences</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {TEAM_COLLABORATION_OPTIONS.map((option) => (
              <label key={option} className={`cursor-pointer rounded-full border px-3 py-2 text-xs transition ${
                form.team.collaboration_preferences.includes(option) ? "border-crimson bg-crimson/10 text-crimson" : "border-charcoal-700 text-warm-white-muted"
              }`}>
                <input type="checkbox" className="sr-only" checked={form.team.collaboration_preferences.includes(option)} onChange={() => patchTeam({ collaboration_preferences: toggle(form.team.collaboration_preferences, option) })} />
                {option}
              </label>
            ))}
            <label className="inline-flex items-center gap-2 text-sm text-warm-white-muted">
              <input type="checkbox" checked={form.team.beginner_friendly} onChange={(event) => patchTeam({ beginner_friendly: event.target.checked })} className="accent-crimson" />
              Beginner-friendly
            </label>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-crimson">Project brief</p>
          <h2 className="team-heading mt-2 text-2xl font-bold text-warm-white">What you’re building</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <label className={labelClass}>Project name
            <input required minLength={2} maxLength={120} value={form.project.project_name} onChange={(event) => patchProject({ project_name: event.target.value })} className={fieldClass} />
          </label>
          <label className={labelClass}>Domain
            <select value={form.project.domain} onChange={(event) => patchProject({ domain: event.target.value })} className={fieldClass}>
              {TEAM_DOMAINS.map((domain) => <option key={domain}>{domain}</option>)}
            </select>
          </label>
          <label className={labelClass}>Category
            <select value={form.project.category} onChange={(event) => patchProject({ category: event.target.value })} className={fieldClass}>
              {TEAM_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label className={labelClass}>Development stage
            <select value={form.project.development_stage} onChange={(event) => patchProject({ development_stage: event.target.value })} className={fieldClass}>
              {TEAM_STAGES.map((stage) => <option key={stage}>{stage}</option>)}
            </select>
          </label>
          <label className={`${labelClass} md:col-span-2`}>Project description
            <textarea required minLength={10} maxLength={3000} rows={3} value={form.project.description} onChange={(event) => patchProject({ description: event.target.value })} className={fieldClass} />
          </label>
          <label className={`${labelClass} md:col-span-2`}>Problem statement
            <textarea required minLength={10} maxLength={3000} rows={3} value={form.project.problem_statement} onChange={(event) => patchProject({ problem_statement: event.target.value })} className={fieldClass} placeholder="Who experiences this problem, and why does it matter?" />
          </label>
          <div className="md:col-span-2">
            <p className={labelClass}>Objectives <span className="font-normal text-warm-white-muted">· one per line</span></p>
            <textarea required rows={3} value={form.project.objectives.join("\n")} onChange={(event) => patchProject({ objectives: event.target.value.split("\n") })} className={fieldClass} placeholder={"Build an accessible prototype\nValidate with student users"} />
          </div>
          <div className="md:col-span-2">
            <p className={labelClass}>Technologies</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {TEAM_TECHNOLOGY_OPTIONS.map((technology) => (
                <label key={technology} className={`cursor-pointer rounded-full border px-3 py-2 text-xs transition ${
                  form.project.technologies.includes(technology) ? "border-crimson bg-crimson/10 text-crimson" : "border-charcoal-700 text-warm-white-muted"
                }`}>
                  <input type="checkbox" className="sr-only" checked={form.project.technologies.includes(technology)} onChange={() => patchProject({ technologies: toggle(form.project.technologies, technology) })} />
                  {technology}
                </label>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input value={customTechnology} maxLength={60} onChange={(event) => setCustomTechnology(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTechnology(); } }} className={fieldClass} placeholder="Add another technology" />
              <button type="button" onClick={addTechnology} className="shrink-0 rounded-xl border border-charcoal-700 px-4 text-sm font-semibold text-warm-white hover:bg-charcoal-800">Add</button>
            </div>
            {form.project.technologies.filter((item) => !TEAM_TECHNOLOGY_OPTIONS.includes(item as typeof TEAM_TECHNOLOGY_OPTIONS[number])).length > 0 && (
              <p className="mt-2 text-xs text-warm-white-muted">Custom: {form.project.technologies.filter((item) => !TEAM_TECHNOLOGY_OPTIONS.includes(item as typeof TEAM_TECHNOLOGY_OPTIONS[number])).join(", ")}</p>
            )}
          </div>
          <label className={labelClass}>GitHub URL (optional)
            <input type="url" maxLength={2048} value={form.project.github_url} onChange={(event) => patchProject({ github_url: event.target.value })} className={fieldClass} placeholder="https://github.com/…" />
          </label>
          <label className={labelClass}>Demo URL (optional)
            <input type="url" maxLength={2048} value={form.project.demo_url} onChange={(event) => patchProject({ demo_url: event.target.value })} className={fieldClass} placeholder="https://…" />
          </label>
        </div>
      </section>

      <section className={sectionClass}>
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-crimson">Recruitment</p>
          <h2 className="team-heading mt-2 text-2xl font-bold text-warm-white">Skills and roles needed</h2>
        </div>
        <div className="space-y-4">
          {form.requiredSkills.map((requirement, index) => (
            <div key={index} className="grid gap-3 rounded-xl border border-charcoal-700 p-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_120px_auto]">
              <label className={labelClass}>Skill
                <select value={TEAM_SKILL_OPTIONS.includes(requirement.skill_name as typeof TEAM_SKILL_OPTIONS[number]) ? requirement.skill_name : "custom"} onChange={(event) => {
                  const next = form.requiredSkills.slice();
                  next[index] = { ...next[index], skill_name: event.target.value === "custom" ? "" : event.target.value };
                  setForm((current) => ({ ...current, requiredSkills: next }));
                }} className={fieldClass}>
                  <option value="custom">Custom skill…</option>
                  {TEAM_SKILL_OPTIONS.map((skill) => <option key={skill}>{skill}</option>)}
                  {requirement.skill_name && !TEAM_SKILL_OPTIONS.includes(requirement.skill_name as typeof TEAM_SKILL_OPTIONS[number]) && <option value={requirement.skill_name}>{requirement.skill_name}</option>}
                </select>
                {(!TEAM_SKILL_OPTIONS.includes(requirement.skill_name as typeof TEAM_SKILL_OPTIONS[number])) && (
                  <input maxLength={80} required value={requirement.skill_name} onChange={(event) => {
                    const next = form.requiredSkills.slice();
                    next[index] = { ...next[index], skill_name: event.target.value };
                    setForm((current) => ({ ...current, requiredSkills: next }));
                  }} className={fieldClass} placeholder="Custom skill name" />
                )}
              </label>
              <label className={labelClass}>Preferred role
                <select value={TEAM_ROLES.includes(requirement.preferred_role as typeof TEAM_ROLES[number]) ? requirement.preferred_role : "Other"} onChange={(event) => {
                  const next = form.requiredSkills.slice();
                  next[index] = { ...next[index], preferred_role: event.target.value };
                  setForm((current) => ({ ...current, requiredSkills: next }));
                }} className={fieldClass}>
                  {TEAM_ROLES.map((role) => <option key={role}>{role}</option>)}
                </select>
              </label>
              <label className={labelClass}>Positions
                <input required type="number" min={1} max={49} value={requirement.positions_required} onChange={(event) => {
                  const next = form.requiredSkills.slice();
                  next[index] = { ...next[index], positions_required: Number(event.target.value) };
                  setForm((current) => ({ ...current, requiredSkills: next }));
                }} className={fieldClass} />
              </label>
              <button type="button" disabled={form.requiredSkills.length === 1} onClick={() => setForm((current) => ({ ...current, requiredSkills: current.requiredSkills.filter((_, itemIndex) => itemIndex !== index) }))} className="self-end rounded-lg px-3 py-3 text-sm text-crimson hover:bg-crimson/5 disabled:opacity-40">Remove</button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <select value={customSkill} onChange={(event) => setCustomSkill(event.target.value)} className={`${fieldClass} max-w-sm`}>
              <option value="">Choose a skill to add</option>
              {TEAM_SKILL_OPTIONS.filter((skill) => !form.requiredSkills.some((item) => item.skill_name.toLowerCase() === skill.toLowerCase())).map((skill) => <option key={skill}>{skill}</option>)}
            </select>
            <button type="button" onClick={() => {
              const skill = customSkill.trim();
              if (!skill) {
                setForm((current) => ({ ...current, requiredSkills: [...current.requiredSkills, { skill_name: "", positions_required: 1, preferred_role: "Other" }] }));
                return;
              }
              setForm((current) => ({ ...current, requiredSkills: [...current.requiredSkills, { skill_name: skill, positions_required: 1, preferred_role: TEAM_ROLES[0] }] }));
              setCustomSkill("");
            }} className="rounded-xl border border-charcoal-700 px-4 py-2 text-sm font-semibold text-warm-white hover:bg-charcoal-800">Add skill</button>
            <input value={customSkill} onChange={(event) => setCustomSkill(event.target.value)} maxLength={80} className={`${fieldClass} max-w-xs`} placeholder="Or type a custom skill" />
            <button type="button" onClick={addCustomSkill} className="rounded-xl border border-charcoal-700 px-4 py-2 text-sm font-semibold text-warm-white hover:bg-charcoal-800">Add custom</button>
          </div>
        </div>
      </section>

      {(validationError || error) && <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{validationError || error}</p>}
      <button type="submit" disabled={submitting || logoBusy} className="w-full rounded-xl bg-crimson px-6 py-3.5 font-semibold text-white shadow-lg shadow-crimson/15 transition hover:bg-crimson-hover disabled:cursor-wait disabled:opacity-60 sm:w-auto">
        {submitting ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
