"use client";

import React, { useState } from "react";
import Link from "next/link";
import { NormalizedHackathon } from "@/lib/aggregator/types";
import { getHackathonPhase, PHASE_BADGE } from "@/lib/hackathon-status";
import {
  BookmarkIcon,
  ExternalLinkIcon,
  CalendarIcon,
  AwardIcon,
  UsersIcon,
  SparklesIcon,
  ShieldIcon,
} from "@/components/ui/icons";

interface HackathonCardProps {
  hackathon: NormalizedHackathon & { phase?: string };
  isSaved?: boolean;
  onToggleSave?: (hackathonId: string) => Promise<void> | void;
  onFindSquad?: (hackathon: NormalizedHackathon) => void;
}

const STATUS_BADGE: Record<string, string> = {
  Open: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  "Closing Soon": "bg-amber-400/15 text-amber-300 border-amber-400/30",
  Closed: "bg-neutral-400/15 text-neutral-300 border-neutral-400/30",
  Unknown: "bg-neutral-400/15 text-neutral-300 border-neutral-400/30",
};

export function HackathonCard({
  hackathon,
  isSaved = false,
  onToggleSave,
  onFindSquad,
}: HackathonCardProps) {
  const [saving, setSaving] = useState(false);
  const [bookmarkError, setBookmarkError] = useState<string | null>(null);

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onToggleSave || saving) return;

    setSaving(true);
    setBookmarkError(null);
    try {
      await onToggleSave(hackathon.id);
    } catch {
      setBookmarkError("Couldn't update the bookmark. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const phase = (hackathon as { phase?: string }).phase ?? getHackathonPhase(hackathon);
  const phaseBadge = PHASE_BADGE[phase as keyof typeof PHASE_BADGE] ?? PHASE_BADGE.unknown;
  const statusClass = STATUS_BADGE[hackathon.registration_status] ?? STATUS_BADGE.Unknown;

  const modeBadge =
    hackathon.mode === "Online"
      ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25"
      : hackathon.mode === "Hybrid"
        ? "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/25"
        : hackathon.mode === "In Person"
          ? "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/25"
          : "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/25";

  const sourceBadge =
    hackathon.source_platform === "Curated"
      ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
      : "border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-500/10";

  const deadlineText = hackathon.registration_deadline
    ? new Date(hackathon.registration_deadline).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not listed";

  const verifiedText = hackathon.verified_at
    ? new Date(hackathon.verified_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const registrationClosed = phase === "registration_closed" || phase === "completed";
  const registrationUnknown = hackathon.registration_status === "Unknown";
  const ctaClass = registrationClosed
    ? "bg-neutral-500 hover:bg-neutral-600"
    : registrationUnknown
      ? "bg-amber-600 hover:bg-amber-700"
      : "bg-crimson hover:bg-crimson-hover";
  const ctaText = registrationClosed ? "View event" : registrationUnknown ? "Check registration" : "Apply now";

  return (
    <article className="group relative rounded-2xl bg-charcoal-900 border border-charcoal-700 hover:border-crimson/40 transition-all flex flex-col justify-between overflow-hidden shadow-sm">
      <div>
        {/* Banner */}
        <div className="relative h-40 w-full overflow-hidden border-b border-charcoal-700 bg-gradient-to-br from-[var(--banner-start)] via-[var(--banner-mid)] to-[var(--banner-end)]">
          {hackathon.banner_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hackathon.banner_url}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <SparklesIcon className="w-12 h-12 text-white/25" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/40" />

          {/* Source + bookmark row */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border backdrop-blur-sm ${sourceBadge}`}>
              {hackathon.source_platform === "Curated" ? "PulsePoint Curated" : `via ${hackathon.source_platform}`}
            </span>

            <button
              onClick={handleBookmark}
              disabled={saving}
              title={isSaved ? "Remove bookmark" : "Save hackathon"}
              aria-label={isSaved ? "Remove bookmark" : "Save hackathon"}
              aria-pressed={isSaved}
              className={`p-2 rounded-xl backdrop-blur-sm border transition-colors ${
                isSaved
                  ? "bg-crimson/15 text-crimson border-crimson/40"
                  : "bg-black/55 text-white border-white/15 hover:bg-black/70"
              }`}
            >
              <BookmarkIcon className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
            </button>
          </div>

          {/* Mode / status / phase badges */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border backdrop-blur-sm ${modeBadge}`}>
              {hackathon.mode || "Format not listed"}
            </span>
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border backdrop-blur-sm ${statusClass}`}>
              {hackathon.registration_status}
            </span>
            {phase === "completed" && (
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border backdrop-blur-sm ${phaseBadge.className}`}>
                {phaseBadge.label}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="text-xs font-medium text-crimson tracking-wide uppercase mb-1 line-clamp-1">
            {hackathon.organizer || "Organizer not listed"}
          </p>

          <Link
            href={`/hackathons/${hackathon.id}`}
            className="block text-lg font-bold text-warm-white hover:text-crimson transition-colors font-serif leading-snug mb-2 line-clamp-2"
          >
            {hackathon.title}
          </Link>

          <p className="text-xs text-warm-white-muted line-clamp-2 leading-relaxed mb-4">
            {hackathon.description || "Description not provided by the source."}
          </p>

          <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-charcoal-800 border border-charcoal-700 text-xs text-warm-white-muted mb-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-3.5 h-3.5 text-crimson shrink-0" />
              <span className="min-w-0">
                <span className="text-[10px] uppercase block text-warm-white-muted/80">Deadline</span>
                <span className="font-medium text-warm-white">{deadlineText}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AwardIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="min-w-0">
                <span className="text-[10px] uppercase block text-warm-white-muted/80">Prizes</span>
                <span className="font-medium text-amber-700 dark:text-amber-300">{hackathon.prize_pool || "Not listed"}</span>
              </span>
            </div>
          </div>

          {hackathon.themes && hackathon.themes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {hackathon.themes.slice(0, 3).map((theme) => (
                <span
                  key={theme}
                  className="px-2 py-0.5 rounded-md text-[10px] bg-charcoal-800 text-warm-white-muted border border-charcoal-700"
                >
                  #{theme}
                </span>
              ))}
              {hackathon.themes.length > 3 && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] text-warm-white-muted">
                  +{hackathon.themes.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Verification line — the trust contract for curated listings */}
          <p className="flex items-center gap-1.5 text-[10px] text-warm-white-muted">
            <ShieldIcon className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            {verifiedText ? `Verified · ${verifiedText}` : "Awaiting curation review"}
          </p>
          {bookmarkError && <p role="alert" className="mt-1 text-[11px] text-rose-700 dark:text-rose-300">{bookmarkError}</p>}
        </div>
      </div>

      {/* Actions */}
      <div className="p-5 pt-0 flex items-center gap-2">
        <Link
          href={`/hackathons/${hackathon.id}`}
          className="flex-1 py-2.5 px-3 rounded-xl border border-charcoal-700 bg-charcoal-800 hover:bg-charcoal-700 text-warm-white text-xs font-semibold text-center transition-colors"
        >
          Details
        </Link>

        {onFindSquad && (
          <button
            onClick={() => onFindSquad(hackathon)}
            title="Find teammates for this hackathon"
            aria-label="Find teammates for this hackathon"
            className="p-2.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/25 transition-colors"
          >
            <UsersIcon className="w-4 h-4" />
          </button>
        )}

        <a
          href={hackathon.apply_url || hackathon.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex-1 py-2.5 px-3 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${ctaClass}`}
        >
          <span>{ctaText}</span>
          <ExternalLinkIcon className="w-3.5 h-3.5 shrink-0" />
        </a>
      </div>
    </article>
  );
}
