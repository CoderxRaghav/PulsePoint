import {
  TEAM_CATEGORIES,
  TEAM_COLLABORATION_OPTIONS,
  TEAM_EXPERIENCE_LEVELS,
  TEAM_STAGES,
  type TeamRequirement,
} from "@/lib/team-types";
import {
  isBoundedText,
  isHttpUrlOrEmpty,
  isRecord,
  isTextList,
} from "@/lib/team-server";

export interface ValidatedTeamPayload {
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
  requiredSkills: TeamRequirement[];
}

function isEnum<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

export function validateTeamPayload(value: unknown): ValidatedTeamPayload | null {
  if (!isRecord(value) || !isRecord(value.team) || !isRecord(value.project) ||
      !Array.isArray(value.requiredSkills) || value.requiredSkills.length > 30) return null;

  const team = value.team;
  const project = value.project;
  if (!isBoundedText(team.team_name, 2, 100) ||
      !isBoundedText(team.description, 10, 2000) ||
      !isBoundedText(team.college, 2, 160) ||
      !Number.isInteger(team.max_members) || Number(team.max_members) < 2 || Number(team.max_members) > 50 ||
      !Number.isInteger(team.positions_open) || Number(team.positions_open) < 0 ||
      Number(team.positions_open) > Number(team.max_members) - 1 ||
      (team.recruitment_status !== "open" && team.recruitment_status !== "closed") ||
      !isEnum(team.experience_level, TEAM_EXPERIENCE_LEVELS) ||
      typeof team.beginner_friendly !== "boolean" ||
      !isTextList(team.collaboration_preferences, TEAM_COLLABORATION_OPTIONS.length, 32) ||
      !team.collaboration_preferences.every((item) => isEnum(item, TEAM_COLLABORATION_OPTIONS)) ||
      !isBoundedText(team.hackathon_name, 0, 160) ||
      !isHttpUrlOrEmpty(team.logo_url)) return null;

  if (!isBoundedText(project.project_name, 2, 120) ||
      !isBoundedText(project.description, 10, 3000) ||
      !isBoundedText(project.problem_statement, 10, 3000) ||
      !isTextList(project.objectives, 12, 300) ||
      project.objectives.length === 0 ||
      !isBoundedText(project.domain, 2, 100) ||
      !isEnum(project.category, TEAM_CATEGORIES) ||
      !isEnum(project.development_stage, TEAM_STAGES) ||
      !isTextList(project.technologies, 25, 60) ||
      !isHttpUrlOrEmpty(project.github_url) ||
      !isHttpUrlOrEmpty(project.demo_url)) return null;

  const skills: TeamRequirement[] = [];
  const seenSkills = new Set<string>();
  for (const requirement of value.requiredSkills) {
    if (!isRecord(requirement) ||
        !isBoundedText(requirement.skill_name, 1, 80) ||
        !Number.isInteger(requirement.positions_required) ||
        Number(requirement.positions_required) < 1 ||
        Number(requirement.positions_required) > Number(team.max_members) - 1 ||
        !isBoundedText(requirement.preferred_role, 1, 80)) return null;
    const normalized = String(requirement.skill_name).trim().toLocaleLowerCase();
    if (seenSkills.has(normalized)) return null;
    seenSkills.add(normalized);
    skills.push({
      skill_name: String(requirement.skill_name).trim(),
      positions_required: Number(requirement.positions_required),
      preferred_role: String(requirement.preferred_role).trim(),
    });
  }
  if (skills.length === 0) return null;

  return {
    team: {
      team_name: team.team_name.trim(),
      description: team.description.trim(),
      college: team.college.trim(),
      max_members: Number(team.max_members),
      positions_open: Number(team.positions_open),
      recruitment_status: team.recruitment_status,
      experience_level: team.experience_level,
      beginner_friendly: team.beginner_friendly,
      collaboration_preferences: team.collaboration_preferences.map((item) => item.trim()),
      hackathon_name: team.hackathon_name.trim(),
      logo_url: team.logo_url.trim(),
    },
    project: {
      project_name: project.project_name.trim(),
      description: project.description.trim(),
      problem_statement: project.problem_statement.trim(),
      objectives: project.objectives.map((item) => item.trim()),
      domain: project.domain.trim(),
      category: project.category,
      development_stage: project.development_stage,
      technologies: project.technologies.map((item) => item.trim()),
      github_url: project.github_url.trim(),
      demo_url: project.demo_url.trim(),
    },
    requiredSkills: skills,
  };
}
