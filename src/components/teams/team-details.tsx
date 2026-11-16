"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { TeamHeader } from "@/components/teams/team-header";
import { TeamForm, type TeamFormPayload } from "@/components/teams/team-form";
import { SuggestedTeammates } from "@/components/teams/suggested-teammates";
import { TaskBoard } from "@/components/teams/task-board";
import { subscribeToAuthChanges } from "@/lib/firebase";
import { teamRequest } from "@/lib/team-client";
import type { TeamDetails as TeamDetailsData, TeamRequest } from "@/lib/team-types";

interface TeamDetailResult {
  team: TeamDetailsData;
}

interface MineResult {
  teams: Array<{ id: string; is_leader: boolean }>;
  requests: Array<{ id: string; team_id: string; status: string }>;
}

const panelClass = "rounded-2xl border border-charcoal-700 bg-charcoal-900 p-5 sm:p-7";

export function TeamDetails({ teamId, created = false }: { teamId: string; created?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [team, setTeam] = useState<TeamDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [membership, setMembership] = useState<{
    userUid: string;
    teamId: string;
    isLeader: boolean;
    isMember: boolean;
    requestStatus: string;
  } | null>(null);
  const [requestOverride, setRequestOverride] = useState<{ userUid: string; teamId: string; status: string } | null>(null);
  const [requests, setRequests] = useState<TeamRequest[]>([]);
  const [requestsTeamId, setRequestsTeamId] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [preferredRole, setPreferredRole] = useState("Member");
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(created);
  const isLeader = Boolean(user && team && membership && membership.userUid === user.uid && membership.teamId === team.id && membership.isLeader);
  const isMember = Boolean(user && team && membership && membership.userUid === user.uid && membership.teamId === team.id && membership.isMember);
  const requestStatus = requestOverride && requestOverride.userUid === user?.uid && requestOverride.teamId === team?.id
    ? requestOverride.status
    : membership && membership.userUid === user?.uid && membership.teamId === team?.id
      ? membership.requestStatus
      : "";
  const visibleRequests = isLeader && requestsTeamId === team?.id ? requests : [];

  const loadTeam = useCallback(async () => {
    try {
      const result = await teamRequest<TeamDetailResult>(user, `/api/teams/${teamId}`);
      setTeam(result.team);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load this team.");
    } finally {
      setLoading(false);
    }
  }, [teamId, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadTeam(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadTeam]);

  useEffect(() => subscribeToAuthChanges((active) => {
    setUser(active);
    setAuthReady(true);
  }), []);

  useEffect(() => {
    if (!user || !team) return;
    let active = true;
    teamRequest<MineResult>(user, "/api/teams/mine")
      .then((mine) => {
        if (!active) return;
        const membership = mine.teams.find((item) => item.id === team.id);
        setMembership({
          userUid: user.uid,
          teamId: team.id,
          isMember: Boolean(membership),
          isLeader: Boolean(membership?.is_leader),
          requestStatus: mine.requests.find((item) => item.team_id === team.id)?.status || "",
        });
      })
      .catch((mineError: unknown) => {
        if (active) setActionError(mineError instanceof Error ? mineError.message : "Could not check your team status.");
      });
    return () => { active = false; };
  }, [team, user]);

  useEffect(() => {
    if (!user || !isLeader) return;
    let active = true;
    teamRequest<{ requests: TeamRequest[] }>(user, `/api/teams/${teamId}/join-requests`)
      .then((result) => {
        if (active) {
          setRequests(result.requests);
          setRequestsTeamId(teamId);
        }
      })
      .catch((requestError: unknown) => {
        if (active) setActionError(requestError instanceof Error ? requestError.message : "Could not load join requests.");
      });
    return () => { active = false; };
  }, [isLeader, teamId, user]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(false), 5200);
    return () => clearTimeout(timer);
  }, [toast]);

  const availablePositions = useMemo(() => team
    ? Math.min(team.positions_open, Math.max(0, team.max_members - team.member_count))
    : 0, [team]);

  const sendRequest = async () => {
    if (!user || busy) return;
    setBusy(true);
    setActionError("");
    try {
      await teamRequest(user, `/api/teams/${teamId}/join-requests`, "POST", {
        message: requestMessage,
        preferredRole,
      });
      setRequestOverride({ userUid: user.uid, teamId, status: "pending" });
      setShowRequestForm(false);
      setRequestMessage("");
    } catch (sendError) {
      setActionError(sendError instanceof Error ? sendError.message : "Could not send your join request.");
    } finally {
      setBusy(false);
    }
  };

  const reviewRequest = async (requestId: string, action: "accept" | "reject") => {
    if (!user || busy) return;
    setBusy(true);
    setActionError("");
    try {
      await teamRequest(user, `/api/teams/${teamId}/join-requests/${requestId}`, "PATCH", { action });
      setRequests((current) => current.filter((request) => request.id !== requestId));
      await loadTeam();
    } catch (reviewError) {
      setActionError(reviewError instanceof Error ? reviewError.message : "Could not update the request.");
    } finally {
      setBusy(false);
    }
  };

  const editTeam = async (payload: TeamFormPayload) => {
    if (!user) return;
    setBusy(true);
    setActionError("");
    try {
      await teamRequest(user, `/api/teams/${teamId}`, "PATCH", payload);
      setEditing(false);
      await loadTeam();
    } catch (updateError) {
      setActionError(updateError instanceof Error ? updateError.message : "Could not update this team.");
    } finally {
      setBusy(false);
    }
  };

  const manageMember = async (userUid: string) => {
    if (!user) return;
    const member = team?.members.find((item) => item.user_uid === userUid);
    const action = member?.user_uid === user.uid ? "leave this team" : `remove ${member?.full_name || "this member"}`;
    if (!window.confirm(`Are you sure you want to ${action}?`)) return;
    setBusy(true);
    setActionError("");
    try {
      await teamRequest(user, `/api/teams/${teamId}/members`, "DELETE", { userUid });
      if (userUid === user.uid) {
        router.push("/teams");
        return;
      }
      await loadTeam();
    } catch (memberError) {
      setActionError(memberError instanceof Error ? memberError.message : "Could not update team membership.");
    } finally {
      setBusy(false);
    }
  };

  const transferLeadership = async (newLeaderUid: string) => {
    if (!user || !newLeaderUid || !window.confirm("Transfer team leadership to this member? You will become a regular member.")) return;
    setBusy(true);
    setActionError("");
    try {
      await teamRequest(user, `/api/teams/${teamId}/members`, "POST", {
        action: "transfer-leadership",
        newLeaderUid,
      });
      setMembership((current) => current && current.userUid === user.uid && current.teamId === teamId
        ? { ...current, isLeader: false, isMember: true }
        : current);
      await loadTeam();
    } catch (transferError) {
      setActionError(transferError instanceof Error ? transferError.message : "Could not transfer leadership.");
    } finally {
      setBusy(false);
    }
  };

  const archiveTeam = async () => {
    if (!user || !window.confirm("Archive this team? It will disappear from discovery and stop accepting requests.")) return;
    setBusy(true);
    setActionError("");
    try {
      await teamRequest(user, `/api/teams/${teamId}`, "PATCH", { action: "archive" });
      await loadTeam();
    } catch (archiveError) {
      setActionError(archiveError instanceof Error ? archiveError.message : "Could not archive this team.");
    } finally {
      setBusy(false);
    }
  };

  const deleteTeam = async () => {
    if (!user || !window.confirm("Permanently delete this team, its project, requests, and membership records? This cannot be undone.")) return;
    setBusy(true);
    setActionError("");
    try {
      await teamRequest(user, `/api/teams/${teamId}`, "DELETE");
      router.push("/teams/mine");
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : "Could not delete this team.");
      setBusy(false);
    }
  };

  const withdrawRequest = async () => {
    if (!user || busy) return;
    setBusy(true);
    setActionError("");
    try {
      const mine = await teamRequest<MineResult>(user, "/api/teams/mine");
      const request = mine.requests.find((item) => item.team_id === teamId);
      if (!request) throw new Error("Your pending request could not be found.");
      await teamRequest(user, `/api/teams/${teamId}/join-requests/${request.id}`, "PATCH", { action: "withdraw" });
      setRequestOverride({ userUid: user.uid, teamId, status: "withdrawn" });
    } catch (withdrawError) {
      setActionError(withdrawError instanceof Error ? withdrawError.message : "Could not withdraw your request.");
    } finally {
      setBusy(false);
    }
  };

  const setNewLeader = (event: ChangeEvent<HTMLSelectElement>) => {
    void transferLeadership(event.target.value);
    event.target.value = "";
  };

  return (
    <div className="min-h-screen bg-space-black text-warm-white">
      <TeamHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/teams" className="text-sm font-medium text-warm-white-muted hover:text-crimson">← Back to team discovery</Link>
        {toast && (
          <div role="status" className="profile-created-toast mt-5 flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 shadow-lg dark:text-emerald-200">
            <span aria-hidden="true" className="text-lg">✓</span> Your team is live. You are the team lead and first member.
          </div>
        )}
        {loading ? (
          <div role="status" className="py-24 text-center text-sm text-warm-white-muted">Loading team details…</div>
        ) : error || !team ? (
          <div role="alert" className="mt-8 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm text-rose-700 dark:text-rose-300">
            {error || "This team could not be found."}
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <section className={`${panelClass} overflow-hidden`}>
              {team.archived_at && <p className="mb-4 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">This team is archived.</p>}
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-charcoal-700 bg-space-dark text-3xl font-semibold text-crimson">
                  {team.logo_url ? <Image src={team.logo_url} alt={`${team.team_name} logo`} width={80} height={80} unoptimized className="h-full w-full object-cover" /> : team.team_name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="team-heading text-3xl font-bold sm:text-4xl">{team.team_name}</h1>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${team.recruitment_status === "open" && availablePositions ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-charcoal-800 text-warm-white-muted"}`}>
                      {team.recruitment_status === "open" && availablePositions ? "Recruiting" : "Not recruiting"}
                    </span>
                  </div>
                  <p className="mt-2 text-warm-white-muted">{team.project.project_name} · {team.project.domain} · {team.college}</p>
                  <p className="mt-4 max-w-3xl leading-7 text-warm-white">{team.description}</p>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-warm-white-muted">
                    <span>Led by {team.leader_name}</span>
                    <span>{new Date(team.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</span>
                    <span>{team.member_count} / {team.max_members} members</span>
                    <span>{availablePositions} positions open</span>
                  </div>
                </div>
                {!isLeader && !isMember && team.recruitment_status === "open" && availablePositions > 0 && (
                  <div className="sm:pt-1">
                    {requestStatus === "pending" ? (
                      <div className="flex flex-col gap-2">
                        <span className="rounded-xl bg-amber-500/10 px-4 py-3 text-center text-sm font-semibold text-amber-700 dark:text-amber-300">Request pending</span>
                        <button type="button" disabled={busy} onClick={() => void withdrawRequest()} className="text-xs text-warm-white-muted underline">Withdraw request</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => {
                        if (!user) {
                          router.push(`/sign-in?next=${encodeURIComponent(`/teams/${teamId}`)}`);
                          return;
                        }
                        setShowRequestForm((shown) => !shown);
                      }} className="rounded-xl bg-crimson px-5 py-3 font-semibold text-white transition hover:bg-crimson-hover">
                        Request to join
                      </button>
                    )}
                  </div>
                )}
              </div>
              {showRequestForm && (
                <div className="mt-6 max-w-2xl rounded-xl border border-charcoal-700 bg-space-black/50 p-4">
                  <h2 className="font-semibold">Send a join request</h2>
                  <label className="mt-4 block text-sm text-warm-white-muted">Preferred role
                    <select value={preferredRole} onChange={(event) => setPreferredRole(event.target.value)} className="mt-1 w-full rounded-xl border border-charcoal-700 bg-charcoal-900 px-3 py-2.5 text-sm text-warm-white">
                      {Array.from(new Set(team.required_skills.map((skill) => skill.preferred_role))).map((role) => <option key={role}>{role}</option>)}
                      <option>Member</option>
                    </select>
                  </label>
                  <label className="mt-4 block text-sm text-warm-white-muted">Message to the team lead
                    <textarea maxLength={1200} rows={3} value={requestMessage} onChange={(event) => setRequestMessage(event.target.value)} className="mt-1 w-full rounded-xl border border-charcoal-700 bg-charcoal-900 px-3 py-3 text-sm text-warm-white" placeholder="Share what interests you about this project and how you can contribute." />
                  </label>
                  <div className="mt-4 flex gap-2">
                    <button type="button" disabled={busy} onClick={() => void sendRequest()} className="rounded-lg bg-crimson px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Sending…" : "Send request"}</button>
                    <button type="button" onClick={() => setShowRequestForm(false)} className="rounded-lg border border-charcoal-700 px-4 py-2 text-sm">Cancel</button>
                  </div>
                </div>
              )}
              {isMember && !isLeader && <p className="mt-5 text-sm font-medium text-emerald-700 dark:text-emerald-300">You’re a member of this team.</p>}
            </section>

            {actionError && <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{actionError}</p>}

            {isLeader && (
              <section className={panelClass}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-crimson">Leader controls</p>
                    <h2 className="team-heading mt-2 text-xl font-bold">Manage your team</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!team.archived_at && (
                      <button type="button" onClick={() => setEditing((current) => !current)} className="rounded-lg border border-charcoal-700 px-3 py-2 text-sm font-semibold hover:bg-charcoal-800">
                        {editing ? "Cancel edit" : "Edit team"}
                      </button>
                    )}
                    {!team.archived_at && <button type="button" disabled={busy} onClick={() => void archiveTeam()} className="rounded-lg border border-amber-500/30 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-500/5 dark:text-amber-300">Archive</button>}
                    <button type="button" disabled={busy} onClick={() => void deleteTeam()} className="rounded-lg border border-rose-500/30 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-500/5 dark:text-rose-300">Delete</button>
                  </div>
                </div>
                {editing && (
                  <div className="mt-6 border-t border-charcoal-700 pt-6">
                    <TeamForm user={user!} initial={team} onSubmit={editTeam} submitLabel="Save team changes" submitting={busy} error={actionError} />
                  </div>
                )}
              </section>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
              <div className="space-y-6">
                <section className={panelClass}>
                  <SectionHeading eyebrow="Project overview" title={team.project.project_name} />
                  <p className="mt-4 leading-7 text-warm-white-muted">{team.project.description}</p>
                  <h3 className="mt-6 font-semibold">Problem statement</h3>
                  <p className="mt-2 leading-7 text-warm-white-muted">{team.project.problem_statement}</p>
                  <h3 className="mt-6 font-semibold">Objectives</h3>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-warm-white-muted">
                    {team.project.objectives.map((objective) => <li key={objective}>{objective}</li>)}
                  </ul>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Tag>{team.project.domain}</Tag><Tag>{team.project.category}</Tag><Tag>{team.project.development_stage}</Tag>
                  </div>
                  {(team.project.github_url || team.project.demo_url) && (
                    <div className="mt-6 flex flex-wrap gap-3">
                      {team.project.github_url && <a className="text-sm font-semibold text-crimson hover:underline" href={team.project.github_url} target="_blank" rel="noopener noreferrer">GitHub repository ↗</a>}
                      {team.project.demo_url && <a className="text-sm font-semibold text-crimson hover:underline" href={team.project.demo_url} target="_blank" rel="noopener noreferrer">Project demo ↗</a>}
                    </div>
                  )}
                  {team.hackathon_name && <p className="mt-5 text-sm text-warm-white-muted">Hackathon: <span className="text-warm-white">{team.hackathon_name}</span></p>}
                </section>

                <section className={panelClass}>
                  <SectionHeading eyebrow="Team" title={`Members (${team.member_count}/${team.max_members})`} />
                  <div className="mt-5 space-y-3">
                    {team.members.map((member) => (
                      <div key={member.user_uid || `${member.role}-${member.joined_at}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-charcoal-700 p-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-space-dark font-semibold text-crimson">
                          {member.photo_url ? <Image src={member.photo_url} alt={`${member.full_name} profile`} width={44} height={44} unoptimized className="h-full w-full object-cover" /> : member.full_name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{member.full_name} {member.role === "Team Lead" && <span className="ml-1 text-xs text-crimson">Team lead</span>}</p>
                          <p className="text-xs text-warm-white-muted">{member.role}{member.college ? ` · ${member.college}` : ""}{member.headline ? ` · ${member.headline}` : ""}</p>
                          {(member.availability || member.collaboration.length > 0) && (
                            <p className="mt-1 text-xs text-warm-white-muted">Availability: <span className="text-warm-white">{member.availability || "Not listed"}</span>{member.collaboration.length > 0 ? ` · ${member.collaboration.join(", ")}` : ""}</p>
                          )}
                          {member.skills.length > 0 && <p className="mt-1 text-xs text-warm-white-muted">Skills: {member.skills.join(", ")}</p>}
                        </div>
                        {isLeader && member.user_uid !== user?.uid && (
                          <button type="button" disabled={busy} onClick={() => void manageMember(member.user_uid)} className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-500/5 dark:text-rose-300">Remove</button>
                        )}
                      </div>
                    ))}
                  </div>
                  {isLeader && team.members.length > 1 && (
                    <label className="mt-5 block max-w-sm text-sm text-warm-white-muted">Transfer leadership
                      <select defaultValue="" disabled={busy} onChange={setNewLeader} className="mt-1 w-full rounded-xl border border-charcoal-700 bg-space-black px-3 py-2.5 text-sm text-warm-white">
                        <option value="" disabled>Choose a current member</option>
                        {team.members.filter((member) => member.user_uid !== user?.uid).map((member) => <option key={member.user_uid} value={member.user_uid}>{member.full_name}</option>)}
                      </select>
                    </label>
                  )}
                  {isMember && !isLeader && <button type="button" disabled={busy} onClick={() => void manageMember(user!.uid)} className="mt-5 rounded-lg border border-charcoal-700 px-3 py-2 text-sm font-semibold text-warm-white-muted hover:border-rose-500/30 hover:text-rose-600">Leave team</button>}
                </section>

                {isMember && (
                  <TaskBoard user={user!} teamId={team.id} members={team.members} isLeader={isLeader} canEdit={!team.archived_at} />
                )}
              </div>

              <aside className="space-y-6">
                <section className={panelClass}>
                  <SectionHeading eyebrow="Recruiting" title="Skills & open roles" />
                  <div className="mt-4 space-y-3">
                    {team.required_skills.map((skill) => (
                      <div key={skill.id || skill.skill_name} className="rounded-xl border border-charcoal-700 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{skill.skill_name}</p>
                            <p className="mt-1 text-xs text-warm-white-muted">{skill.preferred_role}</p>
                          </div>
                          <span className="rounded-full bg-crimson/10 px-2.5 py-1 text-xs font-semibold text-crimson">{skill.positions_required} {skill.positions_required === 1 ? "spot" : "spots"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 border-t border-charcoal-700 pt-4">
                    <h3 className="text-sm font-semibold">Technologies</h3>
                    <div className="mt-3 flex flex-wrap gap-2">{team.project.technologies.map((item) => <Tag key={item}>{item}</Tag>)}</div>
                  </div>
                  <div className="mt-5 border-t border-charcoal-700 pt-4 text-sm text-warm-white-muted">
                    <p>Experience: <span className="text-warm-white">{team.experience_level}</span></p>
                    <p className="mt-2">Beginner-friendly: <span className="text-warm-white">{team.beginner_friendly ? "Yes" : "No"}</span></p>
                    <p className="mt-2">Collaboration: <span className="text-warm-white">{team.collaboration_preferences.join(", ") || "Flexible"}</span></p>
                  </div>
                </section>

                {isLeader && !team.archived_at && (
                  <SuggestedTeammates user={user} teamId={team.id} recruiting={team.recruitment_status === "open" && team.positions_open > 0} />
                )}

                {isLeader && !team.archived_at && (
                  <section className={panelClass}>
                    <SectionHeading eyebrow="Inbox" title={`Join requests (${visibleRequests.length})`} />
                    {visibleRequests.length ? (
                      <div className="mt-4 space-y-4">
                        {visibleRequests.map((request) => (
                          <RequestCard key={request.id} request={request} onReview={reviewRequest} busy={busy} />
                        ))}
                      </div>
                    ) : <p className="mt-4 text-sm text-warm-white-muted">New requests will appear here for you to review.</p>}
                  </section>
                )}
              </aside>
            </div>
          </div>
        )}
        {!authReady && !loading && <p className="sr-only" role="status">Checking your sign-in status.</p>}
      </main>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-crimson">{eyebrow}</p>
      <h2 className="team-heading mt-2 text-xl font-bold">{title}</h2>
    </>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-charcoal-700 bg-space-black/40 px-3 py-1.5 text-xs text-warm-white-muted">{children}</span>;
}

function RequestCard({
  request,
  onReview,
  busy,
}: {
  request: TeamRequest;
  onReview: (requestId: string, action: "accept" | "reject") => Promise<void>;
  busy: boolean;
}) {
  return (
    <article className="rounded-xl border border-charcoal-700 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{request.applicant_name || "PulsePoint student"}</p>
          <p className="mt-1 text-xs text-warm-white-muted">{request.preferred_role}{request.applicant_college ? ` · ${request.applicant_college}` : ""}</p>
        </div>
        <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">Pending</span>
      </div>
      {request.message && <p className="mt-3 text-sm leading-6 text-warm-white-muted">{request.message}</p>}
      {!!request.applicant_skills?.length && <p className="mt-2 text-xs text-warm-white-muted">Skills: {request.applicant_skills.join(", ")}</p>}
      <div className="mt-4 flex gap-2">
        <button type="button" disabled={busy} onClick={() => void onReview(request.id, "accept")} className="flex-1 rounded-lg bg-crimson px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Accept</button>
        <button type="button" disabled={busy} onClick={() => void onReview(request.id, "reject")} className="flex-1 rounded-lg border border-charcoal-700 px-3 py-2 text-xs font-semibold text-warm-white-muted disabled:opacity-50">Reject</button>
      </div>
    </article>
  );
}
