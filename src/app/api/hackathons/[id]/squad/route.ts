import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { NormalizedHackathon } from "@/lib/aggregator/types";

interface StudentProfileDoc {
  uid: string;
  fullName?: string;
  headline?: string;
  college?: string;
  degree?: string;
  branch?: string;
  academicYear?: string;
  photoUrl?: string;
  skills?: Array<string | { name?: unknown }>;
  interests?: unknown;
  github?: string;
  linkedin?: string;
  visibleToStudents?: boolean;
}

/** The stored profile keeps skills as `{ name, category, level }` objects. */
function skillName(skill: unknown): string | null {
  if (typeof skill === "string") return skill;
  if (skill && typeof skill === "object" && typeof (skill as { name?: unknown }).name === "string") {
    return (skill as { name: string }).name;
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing hackathon ID" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();

    // 1. Get the hackathon details to know target skills & themes
    const { data: initialEvent, error: eventError } = await supabase
      .from("hackathons")
      .select("*")
      .eq("id", id)
      .eq("verified", true)
      .is("archived_at", null)
      .maybeSingle();
    if (eventError) {
      throw new Error(`Could not load hackathon for squad matching: ${eventError.message}`);
    }
    let event = initialEvent;
    if (!event) {
      const result = await supabase
        .from("hackathons")
        .select("*")
        .eq("slug", id)
        .eq("verified", true)
        .is("archived_at", null)
        .maybeSingle();
      if (result.error) {
        throw new Error(`Could not load hackathon for squad matching: ${result.error.message}`);
      }
      event = result.data;
    }

    if (!event) {
      return NextResponse.json({ error: "Hackathon not found" }, { status: 404 });
    }
    const verifiedEvent = event as NormalizedHackathon;

    const targetSkills = new Set(
      [...(verifiedEvent.skills || []), ...(verifiedEvent.themes || [])].map((s) => s.toLowerCase().trim())
    );

    // 2. Fetch student profiles
    const { data: profileRows, error } = await supabase
      .from("profiles")
      .select("uid, profile")
      .limit(50);

    if (error) {
      throw error;
    }

    const potentialTeammates = [];

    for (const row of profileRows || []) {
      const p = row.profile as StudentProfileDoc;
      if (!p || p.visibleToStudents === false) continue;

      const normalizedSkills = (Array.isArray(p.skills) ? p.skills : [])
        .map(skillName)
        .filter((name): name is string => Boolean(name && name.trim()))
        .map((name) => name.trim());
      const studentSkills = normalizedSkills.map((name) => name.toLowerCase());
      const studentInterests = (Array.isArray(p.interests) ? p.interests : [])
        .filter((interest): interest is string => typeof interest === "string")
        .map((interest) => interest.toLowerCase().trim())
        .filter(Boolean);
      const allStudentKeywords = [...studentSkills, ...studentInterests];

      // Calculate skill overlap
      const sharedSkills = Array.from(targetSkills).filter((skill) =>
        allStudentKeywords.some((s) => s.includes(skill) || skill.includes(s))
      );

      const matchScore = Math.min(
        100,
        Math.round((sharedSkills.length / Math.max(1, targetSkills.size)) * 100) + 20
      );

      potentialTeammates.push({
        uid: row.uid,
        fullName: p.fullName || "PulsePoint Builder",
        headline: p.headline || "Collegiate Developer",
        college: p.college || "University Student",
        branch: p.branch || "Computer Science",
        academicYear: p.academicYear || "Undergraduate",
        avatarUrl: typeof p.photoUrl === "string" && p.photoUrl ? p.photoUrl : null,
        skills: normalizedSkills,
        sharedSkills,
        matchScore,
        githubUrl: typeof p.github === "string" && p.github ? p.github : null,
        linkedinUrl: typeof p.linkedin === "string" && p.linkedin ? p.linkedin : null,
      });
    }

    // Sort by match score descending
    potentialTeammates.sort((a, b) => b.matchScore - a.matchScore);

    return NextResponse.json({
      hackathonTitle: verifiedEvent.title,
      targetSkills: Array.from(targetSkills),
      teammates: potentialTeammates.slice(0, 12),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
