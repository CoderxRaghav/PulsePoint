"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { NormalizedHackathon } from "@/lib/aggregator/types";
import { HackathonSquadDrawer } from "@/components/hackathons/hackathon-squad-drawer";
import {
  ExternalLinkIcon,
  BookmarkIcon,
  UsersIcon,
  SparklesIcon,
} from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function HackathonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hackathon, setHackathon] = useState<NormalizedHackathon | null>(null);
  const [loadedHackathonId, setLoadedHackathonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [showSquadDrawer, setShowSquadDrawer] = useState(false);
  const loading = loadedHackathonId !== id;

  // Auth listener
  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
    return () => unsub();
  }, []);

  // Fetch hackathon details
  useEffect(() => {
    let isMounted = true;

    fetch(`/api/hackathons/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Hackathon not found");
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
          setError(err.message);
          setLoadedHackathonId(id);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Check if saved
  useEffect(() => {
    if (!currentUser || !id) return;
    currentUser.getIdToken().then((token) => {
      fetch("/api/hackathons/saved", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.savedIds) && data.savedIds.includes(id)) {
            setIsSaved(true);
          }
        })
        .catch(() => {});
    });
  }, [currentUser, id]);

  const handleToggleSave = async () => {
    if (!currentUser) {
      alert("Please sign in to save this hackathon.");
      return;
    }

    const token = await currentUser.getIdToken();
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);

    try {
      await fetch("/api/hackathons/saved", {
        method: nextSaved ? "POST" : "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ hackathonId: id }),
      });
    } catch {
      setIsSaved(!nextSaved);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070709] text-white flex flex-col justify-center items-center">
        <ThemeToggle className="absolute right-4 top-4" />
        <div className="w-10 h-10 rounded-full border-2 border-rose-500 border-t-transparent animate-spin mb-4" />
        <p className="text-xs text-neutral-400">Loading hackathon details...</p>
      </div>
    );
  }

  if (error || !hackathon) {
    return (
      <div className="min-h-screen bg-[#070709] text-white flex flex-col justify-center items-center px-4">
        <ThemeToggle className="absolute right-4 top-4" />
        <div className="max-w-md w-full p-8 rounded-3xl bg-white/[0.02] border border-white/10 text-center">
          <h2 className="text-2xl font-bold font-serif mb-2">Hackathon Not Found</h2>
          <p className="text-xs text-neutral-400 mb-6">
            The requested hackathon may have expired, moved, or the link is invalid.
          </p>
          <Link
            href="/hackathons"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
          >
            Back to Directory
          </Link>
        </div>
      </div>
    );
  }

  const deadlineFormatted = hackathon.registration_deadline
    ? new Date(hackathon.registration_deadline).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not provided";

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
          : ""
      }`
    : "Not provided";

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {/* Top Navbar */}
      <nav className="border-b border-white/10 bg-[#070709]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/hackathons" className="text-xs font-medium text-neutral-400 hover:text-white flex items-center gap-1.5 transition-colors">
              <span>← Hackathons Radar</span>
            </Link>
            <Link href="/teams" className="hidden sm:inline text-xs font-medium text-neutral-400 hover:text-white transition-colors">
              Teams
            </Link>
            <Link href="/profile" className="hidden sm:inline text-xs font-medium text-neutral-400 hover:text-white transition-colors">
              Profile
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={handleToggleSave}
              className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 transition-all ${
                isSaved
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  : "bg-white/5 text-neutral-300 border-white/10 hover:text-white"
              }`}
            >
              <BookmarkIcon className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
              <span className="hidden sm:inline">{isSaved ? "Saved" : "Save Event"}</span>
            </button>

            {/* Official External Link */}
            <a
              href={hackathon.apply_url || hackathon.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-rose-950/40 transition-all"
            >
              <span>Apply on {hackathon.source_platform}</span>
              <ExternalLinkIcon className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 flex-1 space-y-8">
        {/* Event Header Card */}
        <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-[#0e0f17]">
          {/* Banner Hero */}
          <div className="relative h-64 sm:h-80 w-full bg-gradient-to-br from-neutral-900 via-[#181926] to-[#0c0d14]">
            {hackathon.banner_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hackathon.banner_url}
                alt={hackathon.title}
                className="w-full h-full object-cover opacity-75"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-rose-950/30 to-purple-950/30">
                <SparklesIcon className="w-16 h-16 text-rose-500/20" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0e0f17] via-black/40 to-black/30" />

            <div className="absolute top-4 left-4 flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-black/60 border border-white/15 text-neutral-200 backdrop-blur-md">
                Discovered via {hackathon.source_platform}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-md">
                {hackathon.registration_status}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 backdrop-blur-md">
                {hackathon.mode || "Format not listed"}
              </span>
            </div>
          </div>

          {/* Details Bar */}
          <div className="p-6 sm:p-8 -mt-16 relative z-10 space-y-6">
            <div>
              <p className="text-xs uppercase font-bold tracking-widest text-rose-400 mb-1">
                {hackathon.organizer || "Organizer not listed"}
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold font-serif text-white">
                {hackathon.title}
              </h1>
            </div>

            {/* Facts Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-black/50 border border-white/10 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">Deadline</span>
                <span className="font-semibold text-white">{deadlineFormatted}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">Dates</span>
                <span className="font-semibold text-white">{datesFormatted}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">Prizes</span>
                <span className="font-semibold text-amber-300">{hackathon.prize_pool || "Not listed"}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">Location</span>
                <span className="font-semibold text-white truncate">{hackathon.location || "Not listed"}</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href={hackathon.apply_url || hackathon.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40 transition-all"
              >
                <span>Apply on Official Host Portal</span>
                <ExternalLinkIcon className="w-4 h-4" />
              </a>

              <button
                onClick={() => setShowSquadDrawer(true)}
                className="px-5 py-3 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <UsersIcon className="w-4 h-4" />
                <span>Find Teammates with Matching Skills</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Body Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Overview */}
            <section className="p-6 rounded-2xl bg-[#0e0f17] border border-white/10 space-y-3">
              <h2 className="text-lg font-bold font-serif text-white">Event Overview</h2>
              <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-line">
                {hackathon.description || "Description not provided by the source."}
              </p>
            </section>

            {/* Eligibility & Rules */}
            <section className="p-6 rounded-2xl bg-[#0e0f17] border border-white/10 space-y-3">
              <h2 className="text-lg font-bold font-serif text-white">Eligibility & Participation</h2>
              <p className="text-sm text-neutral-300 leading-relaxed">
                {hackathon.eligibility || "Eligibility information not provided by the source."}
              </p>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-neutral-400">
                <span>Team Size: </span>
                <span className="text-white font-semibold">
                  {hackathon.team_size_min != null && hackathon.team_size_max != null
                    ? `${hackathon.team_size_min} to ${hackathon.team_size_max} members`
                    : "Team size not listed"}
                </span>
              </div>
            </section>

            {/* Squad Matching Teaser */}
            <section className="p-6 rounded-2xl bg-gradient-to-r from-violet-950/30 via-[#0e0f17] to-[#0e0f17] border border-violet-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold font-serif text-white flex items-center gap-2">
                    <UsersIcon className="w-4 h-4 text-violet-400" />
                    <span>Assemble Your Squad</span>
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Connect with fellow PulsePoint builders possessing the exact skills required for {hackathon.title}.
                  </p>
                </div>
                <button
                  onClick={() => setShowSquadDrawer(true)}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-all shadow-md"
                >
                  View Matches
                </button>
              </div>
            </section>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-6">
            {/* Themes & Technology */}
            <div className="p-6 rounded-2xl bg-[#0e0f17] border border-white/10 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">
                Themes & Tracks
              </h3>
              <div className="flex flex-wrap gap-2">
                {hackathon.themes && hackathon.themes.length > 0 ? (
                  hackathon.themes.map((theme) => (
                    <span
                      key={theme}
                      className="px-2.5 py-1 rounded-lg text-xs bg-white/5 text-neutral-200 border border-white/10"
                    >
                      {theme}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-neutral-500">Open Innovation</span>
                )}
              </div>

              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400 pt-3">
                Recommended Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {hackathon.skills && hackathon.skills.length > 0 ? (
                  hackathon.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2.5 py-1 rounded-lg text-xs bg-rose-500/10 text-rose-300 border border-rose-500/20"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-neutral-500">All skills welcome</span>
                )}
              </div>
            </div>

            {/* Official Registration Notice */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3 text-xs text-neutral-400">
              <p className="font-semibold text-neutral-300">Registration Notice:</p>
              <p className="leading-relaxed">
                PulsePoint is a discoverability and team assembly engine. Registrations, submissions, and judging take place on the official host platform ({hackathon.source_platform}).
              </p>
              <a
                href={hackathon.apply_url || hackathon.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-rose-400 hover:text-rose-300 underline block pt-1"
              >
                Open Official Registration Portal →
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Squad Discovery Drawer */}
      <HackathonSquadDrawer
        hackathon={showSquadDrawer ? hackathon : null}
        onClose={() => setShowSquadDrawer(false)}
      />

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 bg-[#070709] text-center text-xs text-neutral-500 mt-12">
        © 2026 PulsePoint • Multi-Source Hackathon Radar
      </footer>
    </div>
  );
}
