"use client";

import React from "react";
import { BookmarkIcon, SparklesIcon, FilterIcon } from "@/components/ui/icons";

export type DeadlineFilter = "live" | "7d" | "30d" | "all";

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
  deadlineFilter: DeadlineFilter;
  onDeadlineFilterChange: (value: DeadlineFilter) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
}

const SOURCES = [
  { id: "all", label: "All sources" },
  { id: "Curated", label: "PulsePoint Curation" },
  { id: "OrganizerFeed", label: "Organizer feeds" },
  { id: "SIH", label: "Smart India Hackathon" },
  { id: "MLH", label: "MLH" },
  { id: "Devfolio", label: "Devfolio" },
  { id: "HackerEarth", label: "HackerEarth" },
  { id: "Unstop", label: "Unstop" },
  { id: "Hack2skill", label: "Hack2skill" },
];

const MODES = [
  { id: "all", label: "All formats" },
  { id: "Online", label: "Online" },
  { id: "In Person", label: "In Person" },
  { id: "Hybrid", label: "Hybrid" },
];

const STATUSES = [
  { id: "all", label: "All statuses" },
  { id: "Open", label: "Registration open" },
  { id: "Closing Soon", label: "Closing soon (≤ 72h)" },
  { id: "Closed", label: "Registration closed" },
  { id: "Unknown", label: "No deadline listed" },
];

const DEADLINES: Array<{ id: DeadlineFilter; label: string }> = [
  { id: "live", label: "Open for registration" },
  { id: "7d", label: "Closing within 7 days" },
  { id: "30d", label: "Closing within 30 days" },
  { id: "all", label: "Include closed & completed" },
];

const selectClass =
  "px-3 py-1.5 rounded-xl bg-charcoal-900 border border-charcoal-700 text-warm-white text-xs focus:outline-none focus:border-crimson";

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
  deadlineFilter,
  onDeadlineFilterChange,
  sortBy,
  onSortChange,
}: HackathonFiltersProps) {
  const filtersActive =
    selectedSource !== "all" ||
    selectedMode !== "all" ||
    selectedStatus !== "all" ||
    deadlineFilter !== "live";

  return (
    <div className="py-5 border-b border-charcoal-700 bg-space-black/95 backdrop-blur-md sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
        {/* Tabs + sort */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-charcoal-900 border border-charcoal-700">
            <button
              onClick={() => onTabChange("all")}
              aria-pressed={activeTab === "all"}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === "all"
                  ? "bg-crimson text-white"
                  : "text-warm-white-muted hover:text-warm-white"
              }`}
            >
              All ({totalCount ?? "—"})
            </button>

            <button
              onClick={() => onTabChange("featured")}
              aria-pressed={activeTab === "featured"}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === "featured"
                  ? "bg-crimson text-white"
                  : "text-warm-white-muted hover:text-warm-white"
              }`}
            >
              <SparklesIcon className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>Featured</span>
            </button>

            <button
              onClick={() => onTabChange("saved")}
              aria-pressed={activeTab === "saved"}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === "saved"
                  ? "bg-crimson text-white"
                  : "text-warm-white-muted hover:text-warm-white"
              }`}
            >
              <BookmarkIcon className="w-3.5 h-3.5" />
              <span>Saved ({savedCount})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="hackathon-sort" className="text-xs text-warm-white-muted">Sort by:</label>
            <select
              id="hackathon-sort"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className={selectClass}
            >
              <option value="deadline">Deadline (soonest first)</option>
              <option value="prize">Prize pool (highest)</option>
              <option value="latest">Recently added</option>
            </select>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-warm-white-muted mr-1 font-medium">
            <FilterIcon className="w-3.5 h-3.5 text-crimson" />
            <span>Filters</span>
          </div>

          <select
            aria-label="Filter by registration window"
            value={deadlineFilter}
            onChange={(e) => onDeadlineFilterChange(e.target.value as DeadlineFilter)}
            className={selectClass}
          >
            {DEADLINES.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>

          <select
            aria-label="Filter by source"
            value={selectedSource}
            onChange={(e) => onSourceChange(e.target.value)}
            className={selectClass}
          >
            {SOURCES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>

          <select
            aria-label="Filter by format"
            value={selectedMode}
            onChange={(e) => onModeChange(e.target.value)}
            className={selectClass}
          >
            {MODES.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>

          <select
            aria-label="Filter by registration status"
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className={selectClass}
          >
            {STATUSES.map((st) => (
              <option key={st.id} value={st.id}>{st.label}</option>
            ))}
          </select>

          {filtersActive && (
            <button
              onClick={() => {
                onSourceChange("all");
                onModeChange("all");
                onStatusChange("all");
                onDeadlineFilterChange("live");
              }}
              className="text-xs text-crimson hover:underline ml-1"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
