"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { User } from "firebase/auth";
import type { TeamSummary } from "@/lib/team-types";
import { teamRequest } from "@/lib/team-client";

interface TeamCardProps {
  team: TeamSummary;
  user: User | null;
  requestStatus?: string;
  isMember?: boolean;
}

const cardClass = "rounded-2xl border border-charcoal-700 bg-charcoal-900 p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-crimson/40 hover:shadow-lg";

export function TeamCard({ team, user, requestStatus, isMember = false }: TeamCardProps) {
  const router = useRouter();
  const [localRequest, setLocalRequest] = useState<{ uid: string; status: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const status = localRequest && localRequest.uid === user?.uid ? localRequest.status : requestStatus || "";

  const requestToJoin = async () => {
    if (!user) {
      router.push(`/sign-in?next=${encodeURIComponent(`/teams/${team.id}`)}`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await teamRequest(user, `/api/teams/${team.id}/join-requests`, "POST", {
        message: "",
        preferredRole: team.required_skills[0]?.preferred_role || "Member",
      });
      setLocalRequest({ uid: user.uid, status: "pending" });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not send your request.");
    } finally {
      setBusy(false);
    }
  };

  const available = Math.min(team.positions_open, Math.max(0, team.max_members - team.member_count));

  return (
    <article className={cardClass}>
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-charcoal-700 bg-space-dark text-xl font-semibold text-crimson">
          {team.logo_url ? (
            <Image src={team.logo_url} alt={`${team.team_name} logo`} width={56} height={56} unoptimized className="h-full w-full object-cover" />
          ) : (
            team.team_name.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Link href={`/teams/${team.id}`} className="team-heading text-lg font-bold text-warm-white hover:text-crimson">
            {team.team_name}
          </Link>
          <p className="mt-1 text-sm text-warm-white-muted">{team.project.project_name} · {team.project.domain}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
          team.recruitment_status === "open" && available > 0
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
            : "bg-charcoal-800 text-warm-white-muted"
        }`}>
          {team.recruitment_status === "open" && available > 0 ? "Recruiting" : "Closed"}
        </span>
      </div>

      <p className="mt-4 line-clamp-2 text-sm leading-6 text-warm-white-muted">{team.project.description}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {team.required_skills.slice(0, 4).map((skill) => (
          <span key={skill.id || skill.skill_name} className="rounded-full border border-crimson/15 bg-crimson/5 px-2.5 py-1 text-xs text-warm-white">
            {skill.skill_name}
          </span>
        ))}
        {team.project.technologies.slice(0, 3).map((technology) => (
          <span key={technology} className="rounded-full bg-space-dark px-2.5 py-1 text-xs text-warm-white-muted">
            {technology}
          </span>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-charcoal-700 pt-4 text-xs text-warm-white-muted">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>{team.leader_name} · Lead</span>
          <span>{team.member_count}/{team.max_members} members</span>
          <span>{available} {available === 1 ? "position" : "positions"} open</span>
          <span>{team.college}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/teams/${team.id}`} className="rounded-lg border border-charcoal-700 px-3 py-2 font-semibold text-warm-white transition hover:bg-charcoal-800">
            Details
          </Link>
          {isMember ? (
            <span className="rounded-lg bg-emerald-500/10 px-3 py-2 font-semibold text-emerald-700 dark:text-emerald-300">Member</span>
          ) : status === "pending" ? (
            <span className="rounded-lg bg-amber-500/10 px-3 py-2 font-semibold text-amber-700 dark:text-amber-300">Request pending</span>
          ) : status === "accepted" ? (
            <span className="rounded-lg bg-emerald-500/10 px-3 py-2 font-semibold text-emerald-700 dark:text-emerald-300">Accepted</span>
          ) : team.recruitment_status === "open" && available > 0 ? (
            <button type="button" disabled={busy} onClick={requestToJoin} className="rounded-lg bg-crimson px-3 py-2 font-semibold text-white transition hover:bg-crimson-hover disabled:cursor-wait disabled:opacity-60">
              {busy ? "Sending…" : "Request to join"}
            </button>
          ) : null}
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-300">{error}</p>}
    </article>
  );
}
