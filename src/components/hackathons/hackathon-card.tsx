"use client";

import React, { useState } from "react";
import Link from "next/link";
import { NormalizedHackathon } from "@/lib/aggregator/types";
import {
  BookmarkIcon,
  ExternalLinkIcon,
  CalendarIcon,
  AwardIcon,
  UsersIcon,
  SparklesIcon,
} from "@/components/ui/icons";

interface HackathonCardProps {
  hackathon: NormalizedHackathon;
  isSaved?: boolean;
  onToggleSave?: (hackathonId: string) => Promise<void> | void;
  onFindSquad?: (hackathon: NormalizedHackathon) => void;
}

export function HackathonCard({
  hackathon,
  isSaved = false,
  onToggleSave,
  onFindSquad,
}: HackathonCardProps) {
  const [saving, setSaving] = useState(false);

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onToggleSave || saving) return;

    setSaving(true);
    try {
      await onToggleSave(hackathon.id);
    } catch (error) {
      console.warn("Failed to update hackathon bookmark:", error);
      alert("Could not update this saved hackathon. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const statusColor =
    hackathon.registration_status === "Open"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : hackathon.registration_status === "Closing Soon"
      ? "bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse"
      : "bg-neutral-800 text-neutral-400 border-neutral-700";

  const modeBadgeColor =
    hackathon.mode === "Online"
      ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
      : hackathon.mode === "Hybrid"
      ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
      : hackathon.mode === "In Person"
        ? "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20"
        : "bg-neutral-800 text-neutral-400 border-neutral-700";

  const sourceBadge: Record<string, string> = {
    HackerEarth: "border-orange-500/30 text-orange-400 bg-orange-500/10",
    Devfolio: "border-blue-500/30 text-blue-400 bg-blue-500/10",
    Unstop: "border-amber-500/30 text-amber-400 bg-amber-500/10",
    MLH: "border-rose-500/30 text-rose-400 bg-rose-500/10",
    SIH: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
    Devpost: "border-purple-500/30 text-purple-400 bg-purple-500/10",
    Hack2skill: "border-teal-500/30 text-teal-400 bg-teal-500/10",
    OrganizerFeed: "border-neutral-500/30 text-neutral-300 bg-neutral-500/10",
  };
  const activeSourceBadge = sourceBadge[hackathon.source_platform] || "border-neutral-700 text-neutral-400 bg-white/5";

  // Format deadline date nicely
  const deadlineText = hackathon.registration_deadline
    ? new Date(hackathon.registration_deadline).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not provided";

  return (
    <div className="group relative rounded-2xl bg-[#0f1016]/90 border border-white/10 hover:border-rose-500/30 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-rose-950/20 backdrop-blur-sm">
      {/* Top Banner & Badges */}
      <div>
        <div className="relative h-44 w-full bg-gradient-to-br from-neutral-900 via-[#181926] to-[#0c0d14] overflow-hidden border-b border-white/5">
          {hackathon.banner_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hackathon.banner_url}
              alt={hackathon.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-rose-950/20 via-purple-950/30 to-black/60">
              <SparklesIcon className="w-12 h-12 text-rose-500/30" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#0f1016] via-transparent to-black/60" />

          {/* Top Badges Row */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border backdrop-blur-md ${activeSourceBadge}`}
            >
              via {hackathon.source_platform}
            </span>

            <button
              onClick={handleBookmark}
              disabled={saving}
              title={isSaved ? "Remove Bookmark" : "Save Hackathon"}
              aria-label={isSaved ? "Remove bookmark" : "Save hackathon"}
              className={`p-2 rounded-xl backdrop-blur-md border transition-all ${
                isSaved
                  ? "bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30"
                  : "bg-black/60 text-neutral-300 border-white/10 hover:text-white hover:border-white/30"
              }`}
            >
              <BookmarkIcon className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
            </button>
          </div>

          {/* Mode & Status Bottom Badges */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border backdrop-blur-md ${modeBadgeColor}`}>
              {hackathon.mode || "Format not listed"}
            </span>
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border backdrop-blur-md ${statusColor}`}>
              {hackathon.registration_status}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5">
          <p className="text-xs font-medium text-rose-400/90 tracking-wide uppercase mb-1 line-clamp-1">
            {hackathon.organizer || "Organizer not listed"}
          </p>

          <Link
            href={`/hackathons/${hackathon.id}`}
            className="block text-lg font-bold text-white hover:text-rose-400 transition-colors font-serif leading-snug mb-2 line-clamp-2"
          >
            {hackathon.title}
          </Link>

          <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed mb-4">
            {hackathon.description || "Description not provided by the source."}
          </p>

          {/* Key Facts Grid */}
          <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-black/40 border border-white/5 text-xs text-neutral-300 mb-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-neutral-500 block uppercase">Deadline</span>
                <span className="font-medium text-white truncate">{deadlineText}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <AwardIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-neutral-500 block uppercase">Prizes</span>
                <span className="font-medium text-amber-300 truncate">{hackathon.prize_pool || "Not listed"}</span>
              </div>
            </div>
          </div>

          {/* Themes Tags */}
          {hackathon.themes && hackathon.themes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {hackathon.themes.slice(0, 3).map((theme) => (
                <span
                  key={theme}
                  className="px-2 py-0.5 rounded-md text-[10px] bg-white/5 text-neutral-300 border border-white/5"
                >
                  #{theme}
                </span>
              ))}
              {hackathon.themes.length > 3 && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] text-neutral-500">
                  +{hackathon.themes.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card Actions Footer */}
      <div className="p-5 pt-0 flex items-center gap-2">
        <Link
          href={`/hackathons/${hackathon.id}`}
          className="flex-1 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-semibold text-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500"
        >
          View Details
        </Link>

        {onFindSquad && (
          <button
            onClick={() => onFindSquad(hackathon)}
            title="Find Teammates for this Hackathon"
            className="p-2.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/20 text-xs transition-colors"
          >
            <UsersIcon className="w-4 h-4" />
          </button>
        )}

        {/* APPLY NOW: Must open original official URL */}
        <a
          href={hackathon.apply_url || hackathon.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-semibold text-center flex items-center justify-center gap-1.5 transition-all shadow-md hover:shadow-rose-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <span>Apply Now</span>
          <ExternalLinkIcon className="w-3.5 h-3.5 shrink-0" />
        </a>
      </div>
    </div>
  );
}
