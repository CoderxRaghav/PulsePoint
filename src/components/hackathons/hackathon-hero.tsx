"use client";

import React, { useState } from "react";
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
  aggregatorActive: boolean;
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
  aggregatorActive,
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

  // Format last sync time nicely
  const formattedSyncTime = lastSyncTime
    ? new Date(lastSyncTime).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }) + " today"
    : "Not synced yet";

  return (
    <div className="relative pt-12 pb-10 border-b border-white/10 overflow-hidden bg-gradient-to-b from-[#0e0f17] via-[#070709] to-[#070709]">
      {/* Decorative Glow Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-gradient-to-r from-rose-600/15 via-purple-600/10 to-transparent blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute -top-24 right-10 w-96 h-96 bg-rose-500/10 blur-[140px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Top Sync & Refresh Banner Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-neutral-300">
            <span
              className={`w-2 h-2 rounded-full ${
                aggregatorActive ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              }`}
            />
            <span>
              {aggregatorActive
                ? "Multi-Source Aggregator Active"
                : "Aggregator Awaiting Authorized Sources"}
            </span>
            <span className="text-neutral-500">•</span>
            <span className="text-neutral-400">
              Aggregating Devfolio, HackerEarth, Unstop, MLH & SIH
            </span>
          </div>

          {/* Prominent Global Refresh Button */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-neutral-400 hidden sm:inline">
              Last synced: <span className="text-neutral-300 font-medium">{formattedSyncTime}</span>
            </span>
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/15 text-neutral-200 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-60"
              title="Trigger global synchronization across all external platforms"
            >
              <RefreshCwIcon className={`w-3.5 h-3.5 text-rose-400 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Synchronizing Platforms..." : "Refresh Hackathons"}</span>
            </button>
          </div>
        </div>

        {/* Refresh Notification Toast if returned */}
        {refreshMessage && (
          <div
            className={`mb-6 p-3.5 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${
              refreshMessage.type === "success"
                ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                : refreshMessage.type === "error"
                ? "bg-rose-950/40 border-rose-500/30 text-rose-300"
                : "bg-blue-950/40 border-blue-500/30 text-blue-300"
            }`}
          >
            {refreshMessage.type === "success" ? (
              <CheckCircleIcon className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircleIcon className="w-4 h-4 shrink-0 text-amber-400" />
            )}
            <span>{refreshMessage.text}</span>
          </div>
        )}

        {/* Hero Title & Subheading */}
        <div className="max-w-3xl mb-8">
          <span className="text-xs font-bold uppercase tracking-widest text-rose-500 mb-2 block">
            Collegiate Hackathon Radar
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-serif text-white tracking-tight leading-[1.1] mb-4">
            Discover Hackathons.
          </h1>
          <p className="text-xl sm:text-2xl text-neutral-300 font-light leading-relaxed">
            Build Something Extraordinary.
          </p>
          <p className="text-sm text-neutral-400 mt-2">
            Aggregated in real time from premier platforms, universities, and open hackathon leagues worldwide. Apply directly on official host portals.
          </p>
        </div>

        {/* Dynamic Real Statistics Cards (Never fake hardcoded counts) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-2 text-rose-400 text-xs mb-1">
              <SparklesIcon className="w-4 h-4" />
              <span className="font-semibold uppercase tracking-wider text-[10px]">Active Events</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold font-serif text-white">
              {statsAvailable ? stats.totalActive : "—"}
            </p>
            <span className="text-[11px] text-neutral-400">Open for registrations</span>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-2 text-amber-400 text-xs mb-1">
              <AwardIcon className="w-4 h-4" />
              <span className="font-semibold uppercase tracking-wider text-[10px]">Total Prizes</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold font-serif text-amber-300">
              {statsAvailable ? stats.formattedPrizeSum : "—"}
            </p>
            <span className="text-[11px] text-neutral-400">Calculated value</span>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-2 text-cyan-400 text-xs mb-1">
              <GlobeIcon className="w-4 h-4" />
              <span className="font-semibold uppercase tracking-wider text-[10px]">Virtual / Online</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold font-serif text-white">
              {statsAvailable ? stats.onlineCount : "—"}
            </p>
            <span className="text-[11px] text-neutral-400">Join from anywhere</span>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-2 text-purple-400 text-xs mb-1">
              <CalendarIcon className="w-4 h-4" />
              <span className="font-semibold uppercase tracking-wider text-[10px]">In-Person & Hybrid</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold font-serif text-white">
              {statsAvailable ? stats.inPersonCount : "—"}
            </p>
            <span className="text-[11px] text-neutral-400">Onsite collegiate demos</span>
          </div>
        </div>

        {/* Integrated Search Bar & Quick Theme Pills */}
        <div className="space-y-4">
          <form onSubmit={handleFormSubmit} className="relative max-w-2xl">
            <div className="relative flex items-center">
              <SearchIcon className="absolute left-4 w-5 h-5 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                value={localInput}
                onChange={(e) => {
                  setLocalInput(e.target.value);
                  onSearchChange(e.target.value);
                }}
                placeholder="Search by event title, organizer, skills (e.g. PyTorch, React, Solidity)..."
                className="w-full pl-12 pr-28 py-3.5 rounded-2xl bg-[#12131b] border border-white/15 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 shadow-inner"
              />
              {localInput && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalInput("");
                    onSearchChange("");
                  }}
                  className="absolute right-20 text-xs text-neutral-400 hover:text-white px-2 py-1"
                >
                  Clear
                </button>
              )}
              <button
                type="submit"
                className="absolute right-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all shadow-md"
              >
                Search
              </button>
            </div>
          </form>

          {/* Theme Quick Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-400 font-medium mr-1">Trending Themes:</span>
            {POPULAR_THEMES.map((theme) => {
              const isActive =
                (theme === "All" && selectedTheme === "all") ||
                selectedTheme.toLowerCase() === theme.toLowerCase();

              return (
                <button
                  key={theme}
                  onClick={() => onThemeSelect(theme === "All" ? "all" : theme)}
                  className={`px-3 py-1 rounded-xl text-xs font-medium transition-all border ${
                    isActive
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm"
                      : "bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10 hover:text-white"
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
