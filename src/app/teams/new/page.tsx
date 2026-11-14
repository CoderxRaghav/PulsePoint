"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { TeamForm } from "@/components/teams/team-form";
import { TeamHeader } from "@/components/teams/team-header";
import { teamRequest } from "@/lib/team-client";
import type { TeamFormPayload } from "@/components/teams/team-form";
import { subscribeToAuthChanges } from "@/lib/firebase";

export default function CreateTeamPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => subscribeToAuthChanges((active) => {
    setUser(active);
    setAuthReady(true);
    if (!active) router.replace(`/sign-in?next=${encodeURIComponent("/teams/new")}`);
  }), [router]);

  const createTeam = async (payload: TeamFormPayload) => {
    if (!user || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await teamRequest<{ teamId: string }>(user, "/api/teams", "POST", payload);
      router.push(`/teams/${result.teamId}?created=1`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create the team.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-space-black text-warm-white">
      <TeamHeader />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Link href="/teams" className="text-sm font-medium text-warm-white-muted hover:text-crimson">← Back to teams</Link>
        <div className="mb-8 mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-crimson">Create a Team</p>
          <h1 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">Turn your idea into a team</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-warm-white-muted">Share the project, the skills you need, and how you want to collaborate. Your Firebase account becomes the team lead.</p>
        </div>
        {!authReady ? (
          <p role="status" className="text-sm text-warm-white-muted">Checking your sign-in…</p>
        ) : user ? (
          <TeamForm user={user} onSubmit={createTeam} submitLabel="Create team" submitting={submitting} error={error} />
        ) : (
          <p role="status" className="rounded-xl border border-charcoal-700 p-4 text-sm text-warm-white-muted">Redirecting to sign in…</p>
        )}
      </main>
    </div>
  );
}
