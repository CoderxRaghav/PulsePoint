export const TEAM_SKILL_OPTIONS = [
  "React", "Next.js", "Node.js", "Express", "Python", "Java", "Supabase",
  "MySQL", "Firebase", "AI/ML", "UI/UX", "Figma", "Cloud", "DevOps",
] as const;

export const TEAM_TECHNOLOGY_OPTIONS = [
  "React", "Next.js", "Node.js", "Express", "Python", "Java", "Supabase",
  "MySQL", "Firebase", "AI/ML", "UI/UX", "Figma", "Cloud", "DevOps",
] as const;

export const TEAM_DOMAINS = [
  "AI & Machine Learning", "Climate & Sustainability", "Education",
  "Finance & FinTech", "Health & Wellness", "Social Impact", "Developer Tools",
  "Cybersecurity", "E-commerce", "Open Source", "Other",
] as const;

export const TEAM_CATEGORIES = [
  "Web application", "Mobile application", "AI / ML", "Hardware / IoT",
  "Research", "Open source", "Social impact", "Other",
] as const;

export const TEAM_STAGES = [
  "Idea", "Research", "Design", "Prototype", "Development", "Launched",
] as const;

export const TEAM_ROLES = [
  "Frontend Developer", "Backend Developer", "Full-stack Developer",
  "AI / ML Engineer", "UI / UX Designer", "Product Manager",
  "Data Scientist", "DevOps Engineer", "Researcher", "Other",
] as const;

export const TEAM_EXPERIENCE_LEVELS = [
  "Any", "Beginner", "Intermediate", "Advanced",
] as const;

export const TEAM_COLLABORATION_OPTIONS = [
  "Remote", "In person", "Hybrid", "Async", "Scheduled meetings", "Flexible",
] as const;

export type TeamRecruitmentStatus = "open" | "closed";
export type TeamRequestStatus = "pending" | "accepted" | "rejected" | "withdrawn";
export type TeamTaskStatus = "todo" | "in_progress" | "done";

export interface TeamTask {
  id: string;
  team_id: string;
  title: string;
  details: string;
  assignee_uid: string | null;
  assignee_name?: string | null;
  status: TeamTaskStatus;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TeamProject {
  project_name: string;
  description: string;
  problem_statement: string;
  objectives: string[];
  domain: string;
  category: string;
  development_stage: string;
  technologies: string[];
  github_url: string | null;
  demo_url: string | null;
}

export interface TeamRequirement {
  id?: string;
  skill_name: string;
  positions_required: number;
  preferred_role: string;
}

export interface TeamMember {
  user_uid: string;
  role: string;
  joined_at: string;
  full_name: string;
  photo_url: string | null;
  headline: string;
  college: string;
  skills: string[];
  availability: string | null;
  collaboration: string[];
}

export interface TeamSummary {
  id: string;
  team_name: string;
  description: string;
  leader_name: string;
  leader_photo_url: string | null;
  college: string;
  max_members: number;
  member_count: number;
  positions_open: number;
  recruitment_status: TeamRecruitmentStatus;
  experience_level: string;
  beginner_friendly: boolean;
  collaboration_preferences: string[];
  hackathon_name: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  project: TeamProject;
  required_skills: TeamRequirement[];
}

export interface TeamDetails extends TeamSummary {
  members: TeamMember[];
}

export interface TeamRequest {
  id: string;
  team_id: string;
  applicant_uid: string;
  message: string;
  preferred_role: string;
  status: TeamRequestStatus;
  created_at: string;
  updated_at: string;
  applicant_name?: string;
  applicant_photo_url?: string | null;
  applicant_college?: string;
  applicant_skills?: string[];
  team?: Pick<TeamSummary, "id" | "team_name" | "logo_url" | "recruitment_status">;
}
