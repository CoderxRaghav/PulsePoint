"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { TeamHeader } from "@/components/teams/team-header";
import { TeamCard } from "@/components/teams/team-card";
import { teamRequest } from "@/lib/team-client";
import { TEAM_DOMAINS, TEAM_TECHNOLOGY_OPTIONS, type TeamSummary } from "@/lib/team-types";
import { getStudentProfile } from "@/lib/profile";
import { subscribeToAuthChanges } from "@/lib/firebase";

interface TeamListResult {
  teams: TeamSummary[];
  total: number;
  page: number;
  pageSize: number;
}

interface MyTeamsResult {
  teams: Array<TeamSummary & { is_leader: boolean; member_role: string }>;
  requests: Array<{ team_id: string; status: string }>;
}

const selectClass = "rounded-xl border border-charcoal-700 bg-charcoal-900 px-3 py-2.5 text-sm text-warm-white outline-none focus:border-crimson";

export function TeamsHome() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showcase, setShowcase] = useState<TeamSummary[]>([]);
  const [recent, setRecent] = useState<TeamSummary[]>([]);
  const [myTeams, setMyTeams] = useState<MyTeamsResult["teams"]>([]);
  const [requestStatuses, setRequestStatuses] = useState<Record<string, string>>({});
  const [profileKeywords, setProfileKeywords] = useState<string[]>([]);
  const [showcaseError, setShowcaseError] = useState("");
  const [myTeamsError, setMyTeamsError] = useState("");
  const [recommendationError, setRecommendationError] = useState("");

  useEffect(() => subscribeToAuthChanges((activeUser) => {
    setUser(activeUser);
    setAuthReady(true);
    setMyTeams([]);
    setRequestStatuses({});
    setProfileKeywords([]);
    setMyTeamsError("");
    setRecommendationError("");
  }), []);

  useEffect(() => {
    let active = true;
    Promise.all([
      teamRequest<TeamListResult>(null, "/api/teams?status=open&sortBy=newest&page=0"),
      teamRequest<TeamListResult>(null, "/api/teams?status=all&sortBy=newest&page=0"),
    ])
      .then(([openTeams, newestTeams]) => {
        if (active) {
          setShowcase(openTeams.teams);
          setRecent(newestTeams.teams);
        }
      })
      .catch((error: unknown) => {
        if (active) setShowcaseError(error instanceof Error ? error.message : "The team directory could not be loaded.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    teamRequest<MyTeamsResult>(user, "/api/teams/mine")
      .then((mine) => {
        if (!active) return;
        setMyTeams(mine.teams);
        setRequestStatuses(Object.fromEntries(mine.requests.map((request) => [request.team_id, request.status])));
        setMyTeamsError("");
      })
      .catch((error: unknown) => {
        if (active) setMyTeamsError(error instanceof Error ? error.message : "Could not load your teams.");
      });
    getStudentProfile(user)
      .then((profile) => {
        if (!active) return;
        setProfileKeywords([
          ...(profile?.skills || []).map((skill) => skill.name),
          ...(profile?.interests || []),
          ...(profile?.roles || []),
        ].map((value) => value.toLocaleLowerCase()));
        setRecommendationError("");
      })
      .catch((error: unknown) => {
        if (active) {
          setRecommendationError(error instanceof Error ? error.message : "Could not load recommendations for your profile.");
        }
      });
    return () => { active = false; };
  }, [user]);

  const memberTeamIds = useMemo(() => new Set(myTeams.map((team) => team.id)), [myTeams]);
  const recommended = useMemo(() => {
    if (!profileKeywords.length) return [];
    return showcase
      .filter((team) => team.recruitment_status === "open" && team.positions_open > 0)
      .map((team) => {
        const searchable = [
          team.project.domain,
          team.project.category,
          ...team.project.technologies,
          ...team.required_skills.map((skill) => skill.skill_name),
        ].map((value) => value.toLocaleLowerCase());
        const score = profileKeywords.reduce((total, keyword) =>
          total + (searchable.some((value) => value.includes(keyword) || keyword.includes(value)) ? 1 : 0), 0);
        return { team, score };
      })
      .filter(({ team, score }) => score > 0 && !memberTeamIds.has(team.id))
      .sort((a, b) => b.score - a.score || Date.parse(b.team.created_at) - Date.parse(a.team.created_at))
      .slice(0, 3)
      .map(({ team }) => team);
  }, [memberTeamIds, profileKeywords, showcase]);

  return (
    <div className="min-h-screen bg-space-black text-warm-white">
      <TeamHeader />
      <main>
        <section className="relative overflow-hidden border-b border-charcoal-700 bg-gradient-to-br from-blue-600/10 via-indigo-500/5 to-transparent">
          <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-crimson/10 blur-3xl" />
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-crimson">Build better, together</p>
            <h1 className="team-heading mt-4 max-w-3xl text-4xl font-bold tracking-tight text-warm-white sm:text-5xl">
              Find your people.<br className="hidden sm:block" /> Make the idea real.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-warm-white-muted sm:text-lg">
              Create a project team, discover real student-led ideas, and request to join teams looking for your skills.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/teams/new" className="inline-flex items-center justify-center rounded-xl bg-crimson px-6 py-3.5 font-semibold text-white shadow-lg shadow-crimson/20 transition hover:bg-crimson-hover">
                Create a Team <span aria-hidden="true" className="ml-2">↗</span>
              </Link>
              <a href="#directory" className="inline-flex items-center justify-center rounded-xl border border-charcoal-700 bg-charcoal-900 px-6 py-3.5 font-semibold text-warm-white transition hover:bg-charcoal-800">
                Join a Team <span aria-hidden="true" className="ml-2">↓</span>
              </a>
              {authReady && user && (
                <Link href="/teams/mine" className="inline-flex items-center justify-center rounded-xl border border-charcoal-700 px-6 py-3.5 font-semibold text-warm-white-muted transition hover:bg-charcoal-900">
                  My Teams
                </Link>
              )}
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl space-y-14 px-4 py-10 sm:px-6 lg:px-8">
          {authReady && user && (myTeams.length > 0 || myTeamsError) && (
            <section aria-labelledby="my-teams-heading">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-crimson">Your workspace</p>
                  <h2 id="my-teams-heading" className="team-heading mt-2 text-2xl font-bold">My Teams</h2>
                </div>
                <Link href="/teams/mine" className="text-sm font-semibold text-crimson hover:underline">View all</Link>
              </div>
              {myTeamsError && <p role="alert" className="mb-3 text-sm text-rose-700 dark:text-rose-300">{myTeamsError}</p>}
              <div className="grid gap-4 lg:grid-cols-2">
                {myTeams.slice(0, 2).map((team) => (
                  <TeamCard key={team.id} team={team} user={user} isMember />
                ))}
              </div>
            </section>
          )}

          {(recommended.length > 0 || recommendationError) && (
            <section aria-labelledby="recommended-heading">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-crimson">Matched to your profile</p>
                <h2 id="recommended-heading" className="team-heading mt-2 text-2xl font-bold">Recommended for you</h2>
              </div>
              {recommendationError ? (
                <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{recommendationError}</p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {recommended.map((team) => (
                    <TeamCard key={team.id} team={team} user={user} requestStatus={requestStatuses[team.id]} />
                  ))}
                </div>
              )}
            </section>
          )}

          <section aria-labelledby="recruiting-heading">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-crimson">Open roles right now</p>
              <h2 id="recruiting-heading" className="team-heading mt-2 text-2xl font-bold">Teams recruiting members</h2>
            </div>
            {showcaseError ? (
              <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-300">{showcaseError}</p>
            ) : showcase.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {showcase.slice(0, 4).map((team) => (
                  <TeamCard key={team.id} team={team} user={user} requestStatus={requestStatuses[team.id]} isMember={memberTeamIds.has(team.id)} />
                ))}
              </div>
            ) : (
              <EmptyState title="No teams are recruiting yet" text="Be the first to share a project and invite collaborators." />
            )}
          </section>

          <section aria-labelledby="recent-heading">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-crimson">Fresh projects</p>
              <h2 id="recent-heading" className="team-heading mt-2 text-2xl font-bold">Recently created teams</h2>
            </div>
            {recent.length > 0 && (
              <div className="grid gap-4 lg:grid-cols-2">
                {recent.slice(0, 4).map((team) => (
                  <TeamCard key={team.id} team={team} user={user} requestStatus={requestStatuses[team.id]} isMember={memberTeamIds.has(team.id)} />
                ))}
              </div>
            )}
            {!recent.length && <p className="text-sm text-warm-white-muted">New project teams will appear here as students publish them.</p>}
          </section>

          <TeamDirectory
            user={user}
            memberTeamIds={memberTeamIds}
            requestStatuses={requestStatuses}
          />
        </div>
      </main>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-charcoal-700 bg-charcoal-900/50 px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-crimson/10 text-xl text-crimson">✦</div>
      <h3 className="team-heading mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-warm-white-muted">{text}</p>
    </div>
  );
}

function TeamDirectory({
  user,
  memberTeamIds,
  requestStatuses,
}: {
  user: User | null;
  memberTeamIds: Set<string>;
  requestStatuses: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [technology, setTechnology] = useState("");
  const [domain, setDomain] = useState("");
  const [college, setCollege] = useState("");
  const [positions, setPositions] = useState("");
  const [status, setStatus] = useState("open");
  const [sortBy, setSortBy] = useState("newest");
  const [result, setResult] = useState<TeamListResult>({ teams: [], total: 0, page: 0, pageSize: 24 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({
        status, sortBy, page: String(page),
      });
      if (query.trim()) params.set("query", query.trim());
      if (technology) params.set("technology", technology);
      if (domain) params.set("domain", domain);
      if (college.trim()) params.set("college", college.trim());
      if (positions) params.set("positions", positions);
      teamRequest<TeamListResult>(null, `/api/teams?${params.toString()}`)
        .then((next) => {
          if (!active) return;
          setResult((current) => page === 0 ? next : { ...next, teams: [...current.teams, ...next.teams] });
          setError("");
        })
        .catch((fetchError: unknown) => {
          if (active) setError(fetchError instanceof Error ? fetchError.message : "Could not load teams.");
        })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [college, domain, page, positions, query, sortBy, status, technology]);

  const resetFilters = () => {
    setQuery("");
    setTechnology("");
    setDomain("");
    setCollege("");
    setPositions("");
    setStatus("open");
    setSortBy("newest");
    setPage(0);
  };

  return (
    <section id="directory" aria-labelledby="directory-heading" className="scroll-mt-24">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-crimson">The team directory</p>
        <h2 id="directory-heading" className="team-heading mt-2 text-3xl font-bold">Find your next team</h2>
        <p className="mt-2 text-sm text-warm-white-muted">Browse real project teams and send a join request. A team lead must approve every request.</p>
      </div>

      <div className="mb-6 grid gap-3 rounded-2xl border border-charcoal-700 bg-charcoal-900 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-warm-white-muted sm:col-span-2">Search by team or project
          <input value={query} onChange={(event) => { setPage(0); setQuery(event.target.value); }} className={`mt-1 w-full ${selectClass}`} placeholder="Try a project name or idea…" />
        </label>
        <label className="text-xs font-medium text-warm-white-muted">Technology
          <select value={technology} onChange={(event) => { setPage(0); setTechnology(event.target.value); }} className={`mt-1 w-full ${selectClass}`}>
            <option value="">All technologies</option>
            {TEAM_TECHNOLOGY_OPTIONS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-warm-white-muted">Domain
          <select value={domain} onChange={(event) => { setPage(0); setDomain(event.target.value); }} className={`mt-1 w-full ${selectClass}`}>
            <option value="">All domains</option>
            {TEAM_DOMAINS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-warm-white-muted">College
          <input value={college} onChange={(event) => { setPage(0); setCollege(event.target.value); }} className={`mt-1 w-full ${selectClass}`} placeholder="Filter by institution" />
        </label>
        <label className="text-xs font-medium text-warm-white-muted">Minimum positions
          <select value={positions} onChange={(event) => { setPage(0); setPositions(event.target.value); }} className={`mt-1 w-full ${selectClass}`}>
            <option value="">Any availability</option>
            <option value="1">At least 1</option>
            <option value="2">At least 2</option>
            <option value="3">At least 3</option>
          </select>
        </label>
        <label className="text-xs font-medium text-warm-white-muted">Recruitment status
          <select value={status} onChange={(event) => { setPage(0); setStatus(event.target.value); }} className={`mt-1 w-full ${selectClass}`}>
            <option value="open">Open with positions</option>
            <option value="closed">Closed</option>
            <option value="all">All statuses</option>
          </select>
        </label>
        <label className="text-xs font-medium text-warm-white-muted">Sort by
          <select value={sortBy} onChange={(event) => { setPage(0); setSortBy(event.target.value); }} className={`mt-1 w-full ${selectClass}`}>
            <option value="newest">Newest first</option>
            <option value="positions">Available positions</option>
          </select>
        </label>
        <div className="flex items-end">
          <button type="button" onClick={resetFilters} className="rounded-lg px-3 py-2 text-sm font-semibold text-crimson hover:bg-crimson/5">Reset filters</button>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between text-sm text-warm-white-muted">
        <span>{result.total} {result.total === 1 ? "team" : "teams"}</span>
        {loading && <span aria-live="polite">Updating…</span>}
      </div>
      {error ? (
        <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-300">{error}</p>
      ) : result.teams.length ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {result.teams.map((team) => (
              <TeamCard key={team.id} team={team} user={user} requestStatus={requestStatuses[team.id]} isMember={memberTeamIds.has(team.id)} />
            ))}
          </div>
          {result.teams.length < result.total && (
            <div className="mt-8 text-center">
              <button type="button" disabled={loading} onClick={() => setPage((current) => current + 1)} className="rounded-xl border border-charcoal-700 px-5 py-3 text-sm font-semibold text-warm-white transition hover:bg-charcoal-900 disabled:opacity-50">
                Load more teams
              </button>
            </div>
          )}
        </>
      ) : !loading ? (
        <EmptyState title="No matching teams found" text="Try changing your filters or create a team and invite the right collaborators." />
      ) : null}
    </section>
  );
}
