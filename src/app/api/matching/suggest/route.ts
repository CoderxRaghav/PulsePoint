import { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  authenticatedTeamUid,
  isRecord,
  readTeamJson,
  teamDatabaseError,
  teamJson,
} from "@/lib/team-server";
import { scoreCandidate, MATCH_ALGORITHM_VERSION } from "@/lib/matching";
import type { MatchCandidateProfile } from "@/lib/matching";
import { normalizeSkillList } from "@/lib/matching/features";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SCAN_LIMIT = 500;

function profileSkills(value: unknown): MatchCandidateProfile["skills"] {
  return normalizeSkillList(Array.isArray(value) ? value : []);
}

function profileTextList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

/**
 * POST /api/matching/suggest
 * Deterministic rules-v1 suggestions for a team's open roles. Leader-only:
 * the response exposes profile-derived data, so membership + leadership are
 * verified against the database, never from client input.
 */
export async function POST(request: NextRequest) {
  let uid: string | null;
  try {
    uid = await authenticatedTeamUid(request);
  } catch (error) {
    console.error("[API:Matching:suggest] Firebase authentication configuration failed:", error);
    return teamJson({ error: "Firebase authentication is not configured correctly." }, 500);
  }
  if (!uid) return teamJson({ error: "Authentication required." }, 401);

  const parsed = await readTeamJson(request);
  if (parsed.response) return parsed.response;
  if (!isRecord(parsed.value) || Object.keys(parsed.value).some((key) => !["teamId", "limit"].includes(key))) {
    return teamJson({ error: "Invalid matching request." }, 400);
  }
  const teamId = parsed.value.teamId;
  if (typeof teamId !== "string" || !UUID_PATTERN.test(teamId)) {
    return teamJson({ error: "Team not found." }, 404);
  }
  const limitRaw = parsed.value.limit;
  const limit =
    limitRaw === undefined
      ? 8
      : Number.isInteger(limitRaw) && Number(limitRaw) >= 1 && Number(limitRaw) <= 24
        ? Number(limitRaw)
        : 8;

  try {
    const supabase = getSupabaseAdminClient();
    const { data: team, error: teamError } = await supabase.from("teams")
      .select("id,team_name,leader_uid,archived_at,recruitment_status,collaboration_preferences,project:projects!inner(domain,category,technologies),required_skills:team_required_skills(skill_name,preferred_role)")
      .eq("id", teamId)
      .maybeSingle();
    if (teamError) throw teamError;
    if (!team) return teamJson({ error: "Team not found." }, 404);

    if (team.leader_uid !== uid) {
      return teamJson({ error: "Only the team leader can view match suggestions." }, 403);
    }
    if (team.archived_at || team.recruitment_status !== "open") {
      return teamJson({ suggestions: [], algorithmVersion: MATCH_ALGORITHM_VERSION, note: "Recruitment is closed for this team." });
    }

    const projectCandidate = Array.isArray(team.project) ? team.project[0] : team.project;
    const project: Record<string, unknown> = isRecord(projectCandidate) ? projectCandidate : {};
    const requiredSkills = Array.isArray(team.required_skills)
      ? (team.required_skills as Array<{ skill_name?: unknown; preferred_role?: unknown }>).flatMap((row) => {
          if (typeof row.skill_name !== "string" || typeof row.preferred_role !== "string") return [];
          return [{ skill_name: row.skill_name, preferred_role: row.preferred_role }];
        })
      : [];

    const { data: memberRows, error: membersError } = await supabase.from("team_members")
      .select("user_uid")
      .eq("team_id", teamId);
    if (membersError) throw membersError;
    const excluded = new Set((memberRows || []).map((member) => member.user_uid));
    excluded.add(uid); // never suggest the caller to themselves

    const { data: profileRows, error: profilesError } = await supabase.from("profiles")
      .select("uid,profile")
      .limit(SCAN_LIMIT);
    if (profilesError) throw profilesError;

    const brief = {
      teamId,
      domain: typeof project.domain === "string" ? project.domain : "",
      category: typeof project.category === "string" ? project.category : "",
      technologies: profileTextList(project.technologies),
      requiredSkills,
      collaborationPreferences: Array.isArray(team.collaboration_preferences)
        ? profileTextList(team.collaboration_preferences)
        : [],
    };

    const suggestions = (profileRows || []).flatMap((row) => {
      if (excluded.has(row.uid)) return [];
      const p = isRecord(row.profile) ? row.profile : null;
      if (!p) return [];
      if (p.completed !== true) return []; // only finished profiles are eligible for discovery
      if (p.visibleToStudents === false) return [];
      const candidate: MatchCandidateProfile = {
        uid: row.uid,
        fullName: typeof p.fullName === "string" ? p.fullName : undefined,
        headline: typeof p.headline === "string" ? p.headline : undefined,
        college: typeof p.college === "string" ? p.college : undefined,
        skills: profileSkills(p.skills),
        roles: profileTextList(p.roles),
        interests: profileTextList(p.interests),
        buildGoal: typeof p.buildGoal === "string" ? p.buildGoal : "",
        hoursPerWeek: typeof p.hoursPerWeek === "string" ? p.hoursPerWeek : "",
        collaboration: profileTextList(p.collaboration),
      };
      const evaluation = scoreCandidate(candidate, brief);
      return [{
        candidateId: evaluation.candidateId,
        fullName: candidate.fullName || "PulsePoint student",
        headline: candidate.headline || "",
        college: candidate.college || "",
        photoUrl: typeof p.photoUrl === "string" ? p.photoUrl : null,
        score: evaluation.score,
        reasons: evaluation.reasons,
        matchedSkills: evaluation.matchedSkills,
        complementarySkills: evaluation.complementarySkills,
        algorithmVersion: evaluation.algorithmVersion,
      }];
    }).sort((a, b) => b.score - a.score || a.candidateId.localeCompare(b.candidateId))
      .slice(0, limit);

    return teamJson({
      team_name: team.team_name,
      suggestions,
      algorithmVersion: MATCH_ALGORITHM_VERSION,
    });
  } catch (error) {
    const mapped = teamDatabaseError(error);
    if (mapped.status >= 500) console.error("[API:Matching:suggest] Suggestion query failed:", error);
    return teamJson({ error: mapped.error }, mapped.status);
  }
}
