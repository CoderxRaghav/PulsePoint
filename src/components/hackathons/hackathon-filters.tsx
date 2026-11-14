"use client";

import React from "react";
import { BookmarkIcon, SparklesIcon, FilterIcon } from "@/components/ui/icons";

interface HackathonFiltersProps {
  activeTab: "all" | "featured" | "saved";
  onTabChange: (tab: "all" | "featured" | "saved") => void;
  savedCount: number;
  totalCount: number | null;
  selectedSource: string;
  onSourceChange: (source: string) => void;
  selectedMode: string;
  onModeChange: (mode: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
}

const SOURCES = [
  { id: "all", label: "All Platforms" },
  { id: "Devfolio", label: "Devfolio" },
  { id: "HackerEarth", label: "HackerEarth" },
  { id: "Unstop", label: "Unstop" },
  { id: "MLH", label: "MLH" },
  { id: "Hack2skill", label: "Hack2skill" },
  { id: "SIH", label: "SIH" },
  { id: "Devpost", label: "Devpost" },
  { id: "OrganizerFeed", label: "Organizer feeds" },
];

const MODES = [
  { id: "all", label: "All Formats" },
  { id: "Online", label: "Online" },
  { id: "In Person", label: "In Person" },
  { id: "Hybrid", label: "Hybrid" },
];

const STATUSES = [
  { id: "all", label: "All Statuses" },
  { id: "Open", label: "Open" },
  { id: "Closing Soon", label: "Closing Soon" },
  { id: "Closed", label: "Closed" },
  { id: "Unknown", label: "Unverified status" },
];

export function HackathonFilters({
  activeTab,
  onTabChange,
  savedCount,
  totalCount,
  selectedSource,
  onSourceChange,
  selectedMode,
  onModeChange,
  selectedStatus,
  onStatusChange,
  sortBy,
  onSortChange,
}: HackathonFiltersProps) {
  return (
    <div className="py-6 border-b border-white/10 bg-[#070709]/80 backdrop-blur-md sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Top Bar: Navigation Tabs (All, Featured, Saved) */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 p-1 rounded-2xl bg-[#12131b] border border-white/10">
            <button
              onClick={() => onTabChange("all")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "all"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-950/40"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              All Hackathons ({totalCount ?? "—"})
            </button>

            <button
              onClick={() => onTabChange("featured")}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "featured"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-950/40"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <SparklesIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>Featured</span>
            </button>

            <button
              onClick={() => onTabChange("saved")}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "saved"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-950/40"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <BookmarkIcon className="w-3.5 h-3.5" />
              <span>Saved Events ({savedCount})</span>
            </button>
          </div>

          {/* Sort By Select */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#12131b] border border-white/10 text-white text-xs focus:outline-none focus:border-rose-500"
            >
              <option value="deadline">Registration Deadline (Soonest)</option>
              <option value="prize">Prize Pool (Highest)</option>
              <option value="latest">Recently Added</option>
            </select>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
          <div className="flex items-center gap-1.5 text-neutral-400 mr-2 font-medium">
            <FilterIcon className="w-3.5 h-3.5 text-rose-400" />
            <span>Filters:</span>
          </div>

          {/* Source Dropdown / Pills */}
          <select
            value={selectedSource}
            onChange={(e) => onSourceChange(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[#12131b] border border-white/10 text-neutral-200 text-xs focus:outline-none focus:border-rose-500"
          >
            {SOURCES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Mode Dropdown */}
          <select
            value={selectedMode}
            onChange={(e) => onModeChange(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[#12131b] border border-white/10 text-neutral-200 text-xs focus:outline-none focus:border-rose-500"
          >
            {MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

          {/* Status Dropdown */}
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[#12131b] border border-white/10 text-neutral-200 text-xs focus:outline-none focus:border-rose-500"
          >
            {STATUSES.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </select>

          {/* Reset Filters button if active */}
          {(selectedSource !== "all" || selectedMode !== "all" || selectedStatus !== "all") && (
            <button
              onClick={() => {
                onSourceChange("all");
                onModeChange("all");
                onStatusChange("all");
              }}
              className="text-xs text-rose-400 hover:text-rose-300 underline ml-2"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
