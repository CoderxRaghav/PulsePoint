"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { TeamHeader } from "@/components/teams/team-header";
import { TeamCard } from "@/components/teams/team-card";
import { subscribeToAuthChanges } from "@/lib/firebase";
import { teamRequest } from "@/lib/team-client";
import type { TeamSummary, TeamRequest } from "@/lib/team-types";

interface MineResult {
  teams: Array<TeamSummary & {
    is_leader: boolean;
    member_role: string;
    pending_requests: number;
  }>;
  requests: TeamRequest[];
}

export function MyTeams() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [teams, setTeams] = useState<MineResult["teams"]>([]);
  const [requests, setRequests] = useState<TeamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => subscribeToAuthChanges((active) => {
    setUser(active);
    setLoading(true);
    if (!active) router.replace(`/sign-in?next=${encodeURIComponent("/teams/mine")}`);
  }), [router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    teamRequest<MineResult>(user, "/api/teams/mine")
      .then((result) => {
        if (!active) return;
        setTeams(result.teams);
        setRequests(result.requests);
        setError("");
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load your teams.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user]);

  const withdraw = async (request: TeamRequest) => {
    if (!user) return;
    try {
      await teamRequest(user, `/api/teams/${request.team_id}/join-requests/${request.id}`, "PATCH", { action: "withdraw" });
      setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status: "withdrawn" } : item));
    } catch (withdrawError) {
      setError(withdrawError instanceof Error ? withdrawError.message : "Could not withdraw this request.");
    }
  };

  const openRequests = requests.filter((request) => request.status === "pending");
  const pastRequests = requests.filter((request) => request.status !== "pending");

  return (
    <div className="min-h-screen bg-space-black text-warm-white">
      <TeamHeader />
      <main className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-crimson">Your workspace</p>
            <h1 className="team-heading mt-2 text-3xl font-bold sm:text-4xl">My Teams</h1>
            <p className="mt-3 text-sm text-warm-white-muted">Manage the teams you lead or belong to, and track your join requests.</p>
          </div>
          <Link href="/teams/new" className="rounded-xl bg-crimson px-5 py-3 text-sm font-semibold text-white transition hover:bg-crimson-hover">Create a Team</Link>
        </div>

        {error && <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
        {loading ? (
          <p role="status" className="py-12 text-center text-sm text-warm-white-muted">Loading your teams…</p>
        ) : !user ? (
          <p role="status" className="text-sm text-warm-white-muted">Redirecting to sign in…</p>
        ) : (
          <>
            <section aria-labelledby="membership-heading">
              <div className="mb-5">
                <h2 id="membership-heading" className="team-heading text-2xl font-bold">Teams you created or joined</h2>
                <p className="mt-1 text-sm text-warm-white-muted">Team leaders can edit projects, review requests, and manage members.</p>
              </div>
              {teams.length ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {teams.map((team) => (
                    <div key={team.id} className="space-y-2">
                      <TeamCard team={team} user={user} isMember />
                      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-warm-white-muted">
                        <span>{team.is_leader ? "You’re the team lead" : `Your role: ${team.member_role}`}</span>
                        {team.is_leader && team.pending_requests > 0 && (
                          <Link href={`/teams/${team.id}`} className="rounded-full bg-amber-500/10 px-3 py-1.5 font-semibold text-amber-700 hover:bg-amber-500/15 dark:text-amber-300">
                            {team.pending_requests} pending {team.pending_requests === 1 ? "request" : "requests"} · Review
                          </Link>
                        )}
                        {team.is_leader && team.pending_requests === 0 && (
                          <Link href={`/teams/${team.id}`} className="font-semibold text-crimson hover:underline">Manage team</Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPanel title="You’re not on a team yet" text="Create a new project team or browse open teams to find one that fits." />
              )}
            </section>

            <section aria-labelledby="pending-requests-heading">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <h2 id="pending-requests-heading" className="team-heading text-2xl font-bold">Pending join requests</h2>
                  <p className="mt-1 text-sm text-warm-white-muted">Requests stay pending until a team leader responds.</p>
                </div>
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">{openRequests.length} pending</span>
              </div>
              {openRequests.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {openRequests.map((request) => (
                    <RequestRow key={request.id} request={request} onWithdraw={() => void withdraw(request)} />
                  ))}
                </div>
              ) : (
                <EmptyPanel title="No pending requests" text="When you request to join a team, its status will show up here." />
              )}
            </section>

            <section aria-labelledby="request-history-heading">
              <h2 id="request-history-heading" className="team-heading mb-5 text-2xl font-bold">Request history</h2>
              {pastRequests.length ? (
                <div className="overflow-hidden rounded-2xl border border-charcoal-700 bg-charcoal-900">
                  {pastRequests.map((request) => (
                    <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-charcoal-700 px-4 py-4 last:border-b-0 sm:px-6">
                      <div>
                        <p className="font-semibold">{request.team?.team_name || "Team"}</p>
                        <p className="mt-1 text-xs text-warm-white-muted">Requested {new Date(request.created_at).toLocaleDateString()}</p>
                      </div>
                      <RequestStatus status={request.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-warm-white-muted">Accepted, rejected, and withdrawn requests will appear here.</p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function RequestRow({ request, onWithdraw }: { request: TeamRequest; onWithdraw: () => void }) {
  return (
    <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-charcoal-700 bg-charcoal-900 p-4">
      <div>
        <Link href={`/teams/${request.team_id}`} className="font-semibold hover:text-crimson">{request.team?.team_name || "Team"}</Link>
        <p className="mt-1 text-xs text-warm-white-muted">{request.preferred_role} · Requested {new Date(request.created_at).toLocaleDateString()}</p>
      </div>
      <div className="flex items-center gap-3">
        <RequestStatus status={request.status} />
        <button type="button" onClick={onWithdraw} className="text-xs text-warm-white-muted underline hover:text-crimson">Withdraw</button>
      </div>
    </article>
  );
}

function RequestStatus({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    accepted: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    rejected: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    withdrawn: "bg-charcoal-800 text-warm-white-muted",
  };
  return <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${styles[status] || styles.withdrawn}`}>{status.slice(0, 1).toUpperCase()}{status.slice(1)}</span>;
}

function EmptyPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-charcoal-700 px-6 py-10 text-center">
      <h3 className="team-heading text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-warm-white-muted">{text}</p>
    </div>
  );
}
