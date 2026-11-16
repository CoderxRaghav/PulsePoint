"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { NormalizedHackathon } from "@/lib/aggregator/types";
import { getHackathonPhase, PHASE_BADGE } from "@/lib/hackathon-status";
import { HackathonSquadDrawer } from "@/components/hackathons/hackathon-squad-drawer";
import {
  ExternalLinkIcon,
  BookmarkIcon,
  UsersIcon,
  SparklesIcon,
  ShieldIcon,
  GlobeIcon,
  CheckCircleIcon,
} from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type DetailHackathon = NormalizedHackathon & { phase?: string; archived?: boolean };

export default function HackathonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hackathon, setHackathon] = useState<DetailHackathon | null>(null);
  const [loadedHackathonId, setLoadedHackathonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [showSquadDrawer, setShowSquadDrawer] = useState(false);
  const loading = loadedHackathonId !== id;

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetch(`/api/hackathons/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(typeof data?.error === "string" ? data.error : "Hackathon not found");
        }
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setHackathon(data.hackathon);
          setError(null);
          setLoadedHackathonId(id);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Hackathon not found");
          setLoadedHackathonId(id);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!currentUser || !id) return;
    let cancelled = false;
    currentUser.getIdToken().then((token) => {
      fetch("/api/hackathons/saved", { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled && Array.isArray(data.savedIds)) {
            setIsSaved(data.savedIds.includes(hackathon?.id ?? id));
          }
        })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [currentUser, id, hackathon?.id]);

  const handleToggleSave = async () => {
    if (!currentUser) {
      setSaveNotice("Sign in to save this hackathon.");
      setTimeout(() => setSaveNotice(null), 4000);
      return;
    }

    const bookmarkId = hackathon?.id ?? id;
    const token = await currentUser.getIdToken();
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);

    try {
      const res = await fetch("/api/hackathons/saved", {
        method: nextSaved ? "POST" : "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ hackathonId: bookmarkId }),
      });
      if (!res.ok) setIsSaved(!nextSaved);
    } catch {
      setIsSaved(!nextSaved);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-space-black text-warm-white flex flex-col justify-center items-center">
        <ThemeToggle className="absolute right-4 top-4" />
        <div className="w-10 h-10 rounded-full border-2 border-crimson border-t-transparent animate-spin mb-4" />
        <p className="text-xs text-warm-white-muted">Loading hackathon…</p>
      </div>
    );
  }

  if (error || !hackathon) {
    return (
      <div className="min-h-screen bg-space-black text-warm-white flex flex-col justify-center items-center px-4">
        <ThemeToggle className="absolute right-4 top-4" />
        <div className="max-w-md w-full p-8 rounded-3xl border border-charcoal-700 bg-charcoal-900 text-center">
          <h2 className="text-2xl font-bold font-serif mb-2">Hackathon not found</h2>
          <p className="text-xs text-warm-white-muted mb-6">
            This listing may have been removed or the link is invalid. Saved bookmarks stay valid for as long as the listing exists.
          </p>
          <Link
            href="/hackathons"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-crimson hover:bg-crimson-hover text-white text-xs font-semibold"
          >
            Back to catalog
          </Link>
        </div>
      </div>
    );
  }

  const phase = hackathon.phase ?? getHackathonPhase(hackathon);
  const phaseBadge = PHASE_BADGE[phase as keyof typeof PHASE_BADGE] ?? PHASE_BADGE.unknown;
  const isArchived = Boolean(hackathon.archived || hackathon.archived_at);
  const registrationClosed = phase === "registration_closed" || phase === "completed";
  const registrationUnknown = hackathon.registration_status === "Unknown";

  const deadlineFormatted = hackathon.registration_deadline
    ? new Date(hackathon.registration_deadline).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not listed";

  const datesFormatted = hackathon.start_date
    ? `${new Date(hackathon.start_date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })} – ${
        hackathon.end_date
          ? new Date(hackathon.end_date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "end date not listed"
      }`
    : "Not listed";

  const verifiedFormatted = hackathon.verified_at
    ? new Date(hackathon.verified_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-space-black text-warm-white flex flex-col">
      {/* Nav */}
      <nav className="border-b border-charcoal-700 bg-space-black/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/hackathons" className="text-xs font-medium text-warm-white-muted hover:text-warm-white flex items-center gap-1.5 transition-colors">
              <span aria-hidden>←</span> Hackathons
            </Link>
            <Link href="/teams" className="hidden sm:inline text-xs font-medium text-warm-white-muted hover:text-warm-white transition-colors">
              Teams
            </Link>
            <Link href="/profile" className="hidden sm:inline text-xs font-medium text-warm-white-muted hover:text-warm-white transition-colors">
              Profile
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <button
              onClick={handleToggleSave}
              aria-pressed={isSaved}
              title={isSaved ? "Remove bookmark" : "Save this hackathon"}
              className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 transition-colors ${
                isSaved
                  ? "bg-crimson/10 text-crimson border-crimson/40"
                  : "bg-charcoal-800 text-warm-white-muted border-charcoal-700 hover:text-warm-white"
              }`}
            >
              <BookmarkIcon className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
              <span className="hidden sm:inline">{isSaved ? "Saved" : "Save"}</span>
            </button>

            <a
              href={hackathon.apply_url || hackathon.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 sm:px-4 py-2 rounded-xl bg-crimson hover:bg-crimson-hover text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span className="hidden sm:inline">Official registration</span>
              <span className="sm:hidden">Apply</span>
              <ExternalLinkIcon className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
        {saveNotice && (
          <p role="status" className="max-w-6xl mx-auto px-4 sm:px-6 pb-2 text-xs text-warm-white-muted">{saveNotice}</p>
        )}
      </nav>

      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 flex-1 space-y-6">
        {isArchived && (
          <div role="status" className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs leading-relaxed">
            This event has ended or was archived by PulsePoint curators. The official registration link is kept for reference — bookmarked users keep this page.
          </div>
        )}

        {/* Header card */}
        <div className="relative rounded-3xl overflow-hidden border border-charcoal-700 bg-charcoal-900">
          <div className="relative h-56 sm:h-72 w-full bg-gradient-to-br from-[var(--banner-start)] via-[var(--banner-mid)] to-[var(--banner-end)]">
            {hackathon.banner_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hackathon.banner_url}
                alt=""
                className="w-full h-full object-cover opacity-80"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <SparklesIcon className="w-16 h-16 text-white/25" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />

            <div className="absolute top-4 left-4 flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-black/60 border border-white/15 text-white/90 backdrop-blur-sm">
                {hackathon.source_platform === "Curated" ? "PulsePoint Curated" : `via ${hackathon.source_platform}`}
              </span>
              <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-black/60 border border-white/15 text-white/90 backdrop-blur-sm">
                {hackathon.mode || "Format not listed"}
              </span>
              <span className={`px-3 py-1 rounded-full text-[11px] font-semibold border backdrop-blur-sm ${phaseBadge.className}`}>
                {phaseBadge.label}
              </span>
            </div>
          </div>

          <div className="p-6 sm:p-8 -mt-14 relative z-10 space-y-6">
            <div>
              <p className="inline-flex items-center px-3 py-1 rounded-full bg-black/55 border border-white/15 backdrop-blur-sm text-[11px] uppercase font-bold tracking-widest text-white/90 mb-2">
                {hackathon.organizer || "Organizer not listed"}
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold font-serif text-warm-white leading-tight">
                {hackathon.title}
              </h1>
            </div>

            {/* Facts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-charcoal-800 border border-charcoal-700 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-warm-white-muted block">Registration deadline</span>
                <span className="font-semibold text-warm-white">{deadlineFormatted}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-warm-white-muted block">Event dates</span>
                <span className="font-semibold text-warm-white">{datesFormatted}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-warm-white-muted block">Prizes</span>
                <span className="font-semibold text-amber-700 dark:text-amber-300">{hackathon.prize_pool || "Not listed"}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-warm-white-muted block">Location</span>
                <span className="font-semibold text-warm-white">{hackathon.location || "Not listed"}</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href={hackathon.apply_url || hackathon.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-crimson hover:bg-crimson-hover text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <span>{registrationClosed ? "View on official site" : registrationUnknown ? "Check registration on the official site" : "Register on the official site"}</span>
                <ExternalLinkIcon className="w-4 h-4" />
              </a>

              <button
                onClick={() => setShowSquadDrawer(true)}
                className="px-5 py-3 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <UsersIcon className="w-4 h-4" />
                <span>Find teammates</span>
              </button>
            </div>

            {registrationUnknown && !registrationClosed && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Deadline not published by the organizer — availability of registration cannot be confirmed from this site. The official page is the source of truth.
              </p>
            )}

            {registrationClosed && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Registration appears to be closed. The official site remains the source of truth — organizers sometimes extend deadlines.
              </p>
            )}
          </div>
        </div>

        {/* Body grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section className="p-6 rounded-2xl bg-charcoal-900 border border-charcoal-700 space-y-3">
              <h2 className="text-lg font-bold font-serif text-warm-white">About this event</h2>
              <p className="text-sm text-warm-white-muted leading-relaxed whitespace-pre-line">
                {hackathon.description || "The organizer has not published a description yet. Check the official page for details."}
              </p>
            </section>

            <section className="p-6 rounded-2xl bg-charcoal-900 border border-charcoal-700 space-y-3">
              <h2 className="text-lg font-bold font-serif text-warm-white">Eligibility & team</h2>
              <p className="text-sm text-warm-white-muted leading-relaxed">
                {hackathon.eligibility || "Eligibility information is not published yet. Check the official page."}
              </p>
              <div className="p-3 rounded-xl bg-charcoal-800 border border-charcoal-700 text-xs text-warm-white-muted">
                <span>Team size: </span>
                <span className="text-warm-white font-semibold">
                  {hackathon.team_size_min != null && hackathon.team_size_max != null
                    ? hackathon.team_size_min === hackathon.team_size_max
                      ? `${hackathon.team_size_min} member${hackathon.team_size_min === 1 ? "" : "s"}`
                      : `${hackathon.team_size_min} to ${hackathon.team_size_max} members`
                    : "Not listed"}
                </span>
              </div>
            </section>

            <section className="p-6 rounded-2xl bg-charcoal-900 border border-violet-500/25 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold font-serif text-warm-white flex items-center gap-2">
                    <UsersIcon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    Assemble your squad
                  </h3>
                  <p className="text-xs text-warm-white-muted mt-1">
                    Meet PulsePoint builders with the skills this event calls for.
                  </p>
                </div>
                <button
                  onClick={() => setShowSquadDrawer(true)}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors"
                >
                  View matches
                </button>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            {/* Source & verification — the trust block */}
            <section className="p-6 rounded-2xl bg-charcoal-900 border border-charcoal-700 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-warm-white-muted">
                Source & verification
              </h3>
              <ul className="space-y-2.5 text-xs text-warm-white-muted">
                <li className="flex items-start gap-2">
                  <ShieldIcon className="w-3.5 h-3.5 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    {verifiedFormatted
                      ? <>Last verified on <span className="text-warm-white font-medium">{verifiedFormatted}</span> by PulsePoint curation.</>
                      : "Verification details not published yet."}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <GlobeIcon className="w-3.5 h-3.5 mt-0.5 text-sky-600 dark:text-sky-400 shrink-0" />
                  <a href={hackathon.source_url} target="_blank" rel="noopener noreferrer" className="text-crimson hover:underline break-all">
                    Official listing ({hackathon.source_platform === "Curated" ? "organizer site" : hackathon.source_platform})
                  </a>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="w-3.5 h-3.5 mt-0.5 text-warm-white-muted shrink-0" />
                  <span>PulsePoint is not affiliated with the organizer. Registration, submissions and judging happen on the official site.</span>
                </li>
              </ul>
            </section>

            {/* Themes & skills */}
            <section className="p-6 rounded-2xl bg-charcoal-900 border border-charcoal-700 space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-warm-white-muted mb-2">Themes</h3>
                <div className="flex flex-wrap gap-2">
                  {hackathon.themes && hackathon.themes.length > 0 ? (
                    hackathon.themes.map((theme) => (
                      <span key={theme} className="px-2.5 py-1 rounded-lg text-xs bg-charcoal-800 text-warm-white border border-charcoal-700">
                        {theme}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-warm-white-muted">Open innovation</span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-warm-white-muted mb-2">Suggested skills</h3>
                <div className="flex flex-wrap gap-2">
                  {hackathon.skills && hackathon.skills.length > 0 ? (
                    hackathon.skills.map((skill) => (
                      <span key={skill} className="px-2.5 py-1 rounded-lg text-xs bg-crimson/10 text-crimson border border-crimson/20">
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-warm-white-muted">Not listed — all skills welcome</span>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Squad drawer */}
      <HackathonSquadDrawer
        hackathon={showSquadDrawer ? hackathon : null}
        onClose={() => setShowSquadDrawer(false)}
      />

      <footer className="border-t border-charcoal-700 py-6 bg-space-black text-center text-xs text-warm-white-muted">
        © 2026 PulsePoint · Hackathons catalog
      </footer>
    </div>
  );
}
