"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  SearchIcon,
  SparklesIcon,
  GlobeIcon,
  AwardIcon,
  CalendarIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  AlertCircleIcon,
} from "@/components/ui/icons";

interface HackathonHeroProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  selectedTheme: string;
  onThemeSelect: (theme: string) => void;
  stats: {
    totalActive: number;
    totalCount: number;
    onlineCount: number;
    inPersonCount: number;
    formattedPrizeSum: string;
    uniqueOrganizers: number;
    sources?: string[];
  };
  statsAvailable: boolean;
  isCurator: boolean;
  lastSyncTime?: string | null;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  refreshMessage?: { type: "success" | "info" | "error"; text: string } | null;
}

const POPULAR_THEMES = [
  "All",
  "AI/ML",
  "Web Development",
  "Blockchain",
  "Cybersecurity",
  "Cloud",
  "Open Innovation",
];

export function HackathonHero({
  searchQuery,
  onSearchChange,
  selectedTheme,
  onThemeSelect,
  stats,
  statsAvailable,
  isCurator,
  lastSyncTime,
  onRefresh,
  isRefreshing,
  refreshMessage,
}: HackathonHeroProps) {
  const [localInput, setLocalInput] = useState(searchQuery);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(localInput);
  };

  // External feed syncs are a curator operation; automated ingestion stays
  // disabled until a source is explicitly authorized in the ledger.
  const formattedSyncTime = lastSyncTime
    ? new Date(lastSyncTime).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "never";

  return (
    <div className="relative overflow-hidden border-b border-charcoal-700 bg-space-black">
      {/* Decorative banner glow — from the theme banner tokens */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--banner-start)]/10 via-transparent to-[var(--banner-end)]/10" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10">
        {/* Curation status bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-charcoal-900/70 border border-charcoal-700 text-xs text-warm-white-muted">
            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            <span className="font-medium text-warm-white">Human-verified catalog</span>
            <span className="hidden sm:inline">· every listing cites its official source</span>
          </div>

          <div className="flex items-center gap-3">
            {isCurator && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-charcoal-700 bg-charcoal-900 text-warm-white-muted hover:text-warm-white hover:border-crimson/40 text-xs font-semibold transition-colors disabled:opacity-60"
                title="Curator-only: re-checks authorized external sources (none are authorized yet)"
              >
                <RefreshCwIcon className={`w-3.5 h-3.5 text-crimson ${isRefreshing ? "animate-spin" : ""}`} />
                <span>{isRefreshing ? "Checking…" : "Refresh catalog"}</span>
              </button>
            )}
            <Link
              href="/hackathons/suggest"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-crimson hover:bg-crimson-hover text-white text-xs font-semibold transition-colors shadow-sm"
            >
              Suggest an event
            </Link>
          </div>
        </div>

        {refreshMessage && (
          <div
            role={refreshMessage.type === "error" ? "alert" : "status"}
            className={`mb-6 p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
              refreshMessage.type === "success"
                ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300"
                : refreshMessage.type === "error"
                  ? "border-rose-600/30 bg-rose-600/10 text-rose-800 dark:text-rose-300"
                  : "border-blue-600/30 bg-blue-600/10 text-blue-800 dark:text-blue-300"
            }`}
          >
            {refreshMessage.type === "success" ? (
              <CheckCircleIcon className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircleIcon className="w-4 h-4 shrink-0" />
            )}
            <span>{refreshMessage.text}</span>
          </div>
        )}

        {/* Title & subheading */}
        <div className="max-w-3xl mb-8">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-warm-white tracking-tight leading-[1.08] mb-4 font-serif">
            Hackathons worth your weekend.
          </h1>
          <p className="text-base sm:text-lg text-warm-white-muted leading-relaxed max-w-2xl">
            A small catalog, checked by hand — every listing links to the organizer&apos;s official
            registration page. PulsePoint never registers you on a host&apos;s behalf.
          </p>
          {isCurator && (
            <p className="text-xs text-warm-white-muted mt-3">
              Last external sync: {formattedSyncTime}. Automated sources activate only after written permission is recorded in the sources ledger.
            </p>
          )}
        </div>

        {/* Live catalog statistics (computed from the catalog — never fabricated) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <div className="p-4 rounded-2xl border border-charcoal-700 bg-charcoal-900/70">
            <div className="flex items-center gap-2 text-crimson text-xs mb-1.5">
              <SparklesIcon className="w-4 h-4" />
              <span className="font-semibold uppercase tracking-wider text-[10px] text-warm-white-muted">Live events</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold font-serif text-warm-white">
              {statsAvailable ? stats.totalActive : "—"}
            </p>
            <span className="text-[11px] text-warm-white-muted">Still open for registration</span>
          </div>

          <div className="p-4 rounded-2xl border border-charcoal-700 bg-charcoal-900/70">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs mb-1.5">
              <AwardIcon className="w-4 h-4" />
              <span className="font-semibold uppercase tracking-wider text-[10px] text-warm-white-muted">Listed prizes</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold font-serif text-amber-600 dark:text-amber-300">
              {statsAvailable ? stats.formattedPrizeSum : "—"}
            </p>
            <span className="text-[11px] text-warm-white-muted">Sum across live listings</span>
          </div>

          <div className="p-4 rounded-2xl border border-charcoal-700 bg-charcoal-900/70">
            <div className="flex items-center gap-2 text-sky-600 dark:text-cyan-400 text-xs mb-1.5">
              <GlobeIcon className="w-4 h-4" />
              <span className="font-semibold uppercase tracking-wider text-[10px] text-warm-white-muted">Online</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold font-serif text-warm-white">
              {statsAvailable ? stats.onlineCount : "—"}
            </p>
            <span className="text-[11px] text-warm-white-muted">Join from anywhere</span>
          </div>

          <div className="p-4 rounded-2xl border border-charcoal-700 bg-charcoal-900/70">
            <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 text-xs mb-1.5">
              <CalendarIcon className="w-4 h-4" />
              <span className="font-semibold uppercase tracking-wider text-[10px] text-warm-white-muted">In person</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold font-serif text-warm-white">
              {statsAvailable ? stats.inPersonCount : "—"}
            </p>
            <span className="text-[11px] text-warm-white-muted">On-campus and in-person</span>
          </div>
        </div>

        {/* Search */}
        <div className="space-y-4">
          <form onSubmit={handleFormSubmit} className="relative max-w-2xl">
            <div className="relative flex items-center">
              <SearchIcon className="absolute left-4 w-5 h-5 text-warm-white-muted pointer-events-none" />
              <input
                type="text"
                value={localInput}
                onChange={(e) => {
                  setLocalInput(e.target.value);
                  onSearchChange(e.target.value);
                }}
                aria-label="Search hackathons"
                placeholder="Search by title, organizer or keywords…"
                className="w-full pl-12 pr-24 py-3.5 rounded-2xl bg-charcoal-900 border border-charcoal-700 text-warm-white placeholder:text-warm-white-muted text-sm focus:outline-none focus:border-crimson focus:ring-2 focus:ring-crimson/20"
              />
              {localInput && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalInput("");
                    onSearchChange("");
                  }}
                  className="absolute right-[4.5rem] text-xs text-warm-white-muted hover:text-warm-white px-2 py-1"
                >
                  Clear
                </button>
              )}
              <button
                type="submit"
                className="absolute right-2 px-4 py-2 rounded-xl bg-crimson hover:bg-crimson-hover text-white text-xs font-semibold transition-colors"
              >
                Search
              </button>
            </div>
          </form>

          {/* Theme quick pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-warm-white-muted font-medium mr-1">Themes:</span>
            {POPULAR_THEMES.map((theme) => {
              const isActive =
                (theme === "All" && selectedTheme === "all") ||
                selectedTheme.toLowerCase() === theme.toLowerCase();

              return (
                <button
                  key={theme}
                  onClick={() => onThemeSelect(theme === "All" ? "all" : theme)}
                  aria-pressed={isActive}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border ${
                    isActive
                      ? "bg-crimson text-white border-crimson"
                      : "bg-charcoal-900 border-charcoal-700 text-warm-white-muted hover:text-warm-white hover:border-[var(--border-strong)]"
                  }`}
                >
                  {theme}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
