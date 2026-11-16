"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { User } from "firebase/auth";
import { teamRequest } from "@/lib/team-client";

export interface Suggestion {
  candidateId: string;
  fullName: string;
  headline: string;
  college: string;
  photoUrl: string | null;
  score: number;
  reasons: string[];
  matchedSkills: string[];
  complementarySkills: string[];
  algorithmVersion: string;
}

interface SuggestResponse {
  suggestions: Suggestion[];
  algorithmVersion: string;
  note?: string;
  error?: string;
}

const panelClass = "rounded-2xl border border-charcoal-700 bg-charcoal-900 p-5 sm:p-7";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "PP";
}

/**
 * rules-v1 explainable suggestions for a team's open roles.
 * Renders nothing for signed-out visitors; leadership enforcement happens server-side.
 */
export function SuggestedTeammates({ user, teamId, recruiting }: {
  user: User | null;
  teamId: string;
  recruiting: boolean;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const loading = suggestions === null && error === null;

  useEffect(() => {
    if (!user || !recruiting) return;
    let active = true;

    teamRequest<SuggestResponse>(user, "/api/matching/suggest", "POST", { teamId, limit: 6 })
      .then((data) => {
        if (!active) return;
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        setNote(typeof data.note === "string" ? data.note : null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setSuggestions([]);
        setError(err instanceof Error ? err.message : "Could not load match suggestions.");
      });

    return () => {
      active = false;
    };
  }, [user, teamId, recruiting, retryNonce]);

  if (!user || !recruiting) return null;

  const dismiss = async (candidateId: string) => {
    if (dismissing) return;
    setDismissing(candidateId);
    try {
      await teamRequest(user, "/api/matching/feedback", "POST", { teamId, candidateUid: candidateId, outcome: "dismissed" });
      setSuggestions((current) => (current ?? []).filter((item) => item.candidateId !== candidateId));
    } catch {
      // Leave the card in place — feedback is best effort and can be retried.
    } finally {
      setDismissing(null);
    }
  };

  return (
    <section className={panelClass} aria-label="Suggested teammates">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-crimson">Matching · rules-v1</p>
      <h2 className="team-heading mt-2 text-xl font-bold">Suggested teammates</h2>
      <p className="mt-1 text-xs text-warm-white-muted">Ranked on visible profile signals — not a probability, and you can ignore any of it.</p>

      {loading && (
        <div className="mt-4 space-y-3" aria-busy="true">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-20 animate-pulse rounded-xl border border-charcoal-700 bg-space-black/40" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="mt-4">
          <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>
          <button type="button" onClick={() => { setSuggestions(null); setError(null); setRetryNonce((n) => n + 1); }} className="mt-3 rounded-lg border border-charcoal-700 px-3 py-2 text-sm font-semibold text-warm-white-muted hover:text-warm-white">Try again</button>
        </div>
      )}

      {!loading && !error && note && (
        <p className="mt-4 text-sm text-warm-white-muted">{note}</p>
      )}

      {!loading && !error && !note && suggestions && suggestions.length === 0 && (
        <p className="mt-4 text-sm leading-6 text-warm-white-muted">No visible, completed student profiles overlap these open roles yet — check again as more students finish their profiles.</p>
      )}

      {!loading && !error && suggestions && suggestions.length > 0 && (
        <ul className="mt-4 space-y-3">
          {suggestions.map((suggestion) => (
            <li key={suggestion.candidateId} className="rounded-xl border border-charcoal-700 p-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-space-dark text-xs font-semibold text-crimson" aria-hidden="true">
                  {suggestion.photoUrl ? <Image src={suggestion.photoUrl} alt="" width={40} height={40} unoptimized className="h-full w-full object-cover" /> : initials(suggestion.fullName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold">{suggestion.fullName}</p>
                    <span className="shrink-0 rounded-full bg-crimson/10 px-2.5 py-1 text-[11px] font-semibold text-crimson" title="Deterministic rules-v1 match score">{suggestion.score}/100</span>
                  </div>
                  {suggestion.headline && <p className="mt-0.5 truncate text-xs text-warm-white-muted">{suggestion.headline}{suggestion.college ? ` · ${suggestion.college}` : ""}</p>}
                  {suggestion.reasons.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {suggestion.reasons.slice(0, 3).map((reason) => (
                        <li key={reason} className="flex items-start gap-1.5 text-xs leading-5 text-warm-white-muted"><span aria-hidden="true" className="text-crimson">•</span>{reason}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {suggestion.matchedSkills.slice(0, 4).map((skill) => (
                        <span key={skill} className="rounded-full border border-charcoal-700 bg-space-black/40 px-2 py-0.5 text-[11px] text-warm-white-muted">{skill}</span>
                      ))}
                    </div>
                    <button type="button" disabled={dismissing === suggestion.candidateId} onClick={() => void dismiss(suggestion.candidateId)} className="shrink-0 rounded-lg border border-charcoal-700 px-2.5 py-1 text-[11px] font-semibold text-warm-white-muted transition hover:border-rose-500/30 hover:text-rose-400 disabled:opacity-50" aria-label={`Dismiss suggestion ${suggestion.fullName}`}>{dismissing === suggestion.candidateId ? "…" : "Dismiss"}</button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && (
        <p className="mt-4 border-t border-charcoal-700 pt-3 text-[11px] leading-5 text-warm-white-muted">Missing data counts as neutral, never zero. Dismissing a suggestion records private, first-party feedback for rules-v1 evaluation — it never blocks the student. Non-visible and unfinished profiles, current members, and the team lead never appear.</p>
      )}
    </section>
  );
}
