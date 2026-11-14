import "server-only";

import { isRecord } from "@/lib/team-server";
import type { TeamMember, TeamProject, TeamRequirement, TeamSummary } from "@/lib/team-types";

export const TEAM_SELECT = [
  "id", "team_name", "description", "leader_uid", "college", "max_members",
  "member_count", "positions_open", "recruitment_status", "experience_level",
  "beginner_friendly", "collaboration_preferences", "hackathon_name", "logo_url",
  "created_at", "updated_at", "archived_at",
  "project:projects!inner(project_name,description,problem_statement,objectives,domain,category,development_stage,technologies,github_url,demo_url)",
  "required_skills:team_required_skills(id,skill_name,positions_required,preferred_role)",
].join(",");

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function profileDetails(profileValue: unknown) {
  const profile = isRecord(profileValue) ? profileValue : {};
  const visible = profile.visibleToStudents !== false;
  const skills = Array.isArray(profile.skills)
    ? profile.skills.flatMap((skill) => {
        if (typeof skill === "string") return [skill];
        if (isRecord(skill) && typeof skill.name === "string") return [skill.name];
        return [];
      })
    : [];
  return {
    fullName: visible && typeof profile.fullName === "string" ? profile.fullName : "Private member",
    photoUrl: visible && typeof profile.photoUrl === "string" ? profile.photoUrl : null,
    headline: visible && typeof profile.headline === "string" ? profile.headline : "",
    college: visible && typeof profile.college === "string" ? profile.college : "",
    skills: visible ? skills : [],
  };
}

export function toTeamSummary(row: Record<string, unknown>, profileValue: unknown): TeamSummary {
  const projectCandidate = Array.isArray(row.project) ? row.project[0] : row.project;
  const project = isRecord(projectCandidate) ? projectCandidate : {};
  const requirements = Array.isArray(row.required_skills) ? row.required_skills : [];
  const leader = profileDetails(profileValue);
  const teamProject: TeamProject = {
    project_name: text(project.project_name),
    description: text(project.description),
    problem_statement: text(project.problem_statement),
    objectives: stringList(project.objectives),
    domain: text(project.domain),
    category: text(project.category),
    development_stage: text(project.development_stage),
    technologies: stringList(project.technologies),
    github_url: typeof project.github_url === "string" ? project.github_url : null,
    demo_url: typeof project.demo_url === "string" ? project.demo_url : null,
  };
  const requiredSkills: TeamRequirement[] = requirements.flatMap((value): TeamRequirement[] => {
    if (!isRecord(value)) return [];
    return [{
      id: typeof value.id === "string" ? value.id : undefined,
      skill_name: text(value.skill_name),
      positions_required: Number(value.positions_required) || 0,
      preferred_role: text(value.preferred_role),
    }];
  });

  return {
    id: text(row.id),
    team_name: text(row.team_name),
    description: text(row.description),
    leader_name: leader.fullName || "PulsePoint student",
    leader_photo_url: leader.photoUrl,
    college: text(row.college),
    max_members: Number(row.max_members) || 0,
    member_count: Number(row.member_count) || 0,
    positions_open: Number(row.positions_open) || 0,
    recruitment_status: row.recruitment_status === "closed" ? "closed" : "open",
    experience_level: text(row.experience_level),
    beginner_friendly: row.beginner_friendly === true,
    collaboration_preferences: stringList(row.collaboration_preferences),
    hackathon_name: typeof row.hackathon_name === "string" ? row.hackathon_name : null,
    logo_url: typeof row.logo_url === "string" ? row.logo_url : null,
    created_at: text(row.created_at),
    updated_at: text(row.updated_at),
    archived_at: typeof row.archived_at === "string" ? row.archived_at : null,
    project: teamProject,
    required_skills: requiredSkills,
  };
}

export function toTeamMember(
  row: Record<string, unknown>,
  profileValue: unknown,
  visibleUids: ReadonlySet<string> = new Set(),
): TeamMember {
  const profile = profileDetails(profileValue);
  const userUid = text(row.user_uid);
  return {
    user_uid: visibleUids.has(userUid) ? userUid : "",
    role: text(row.role) || "Member",
    joined_at: text(row.joined_at),
    full_name: profile.fullName,
    photo_url: profile.photoUrl,
    headline: profile.headline,
    college: profile.college,
    skills: profile.skills,
  };
}
