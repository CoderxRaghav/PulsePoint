"use client";

import React, { useEffect, useState } from "react";
import { NormalizedHackathon } from "@/lib/aggregator/types";
import {
  UsersIcon,
  XIcon,
  SparklesIcon,
  ExternalLinkIcon,
  CheckCircleIcon,
} from "@/components/ui/icons";

interface TeammateMatch {
  uid: string;
  fullName: string;
  headline: string;
  college: string;
  branch: string;
  academicYear: string;
  avatarUrl: string | null;
  skills: string[];
  sharedSkills: string[];
  matchScore: number;
  githubUrl: string | null;
  linkedinUrl: string | null;
}

interface HackathonSquadDrawerProps {
  hackathon: NormalizedHackathon | null;
  onClose: () => void;
}

export function HackathonSquadDrawer({
  hackathon,
  onClose,
}: HackathonSquadDrawerProps) {
  const [loadedHackathonId, setLoadedHackathonId] = useState<string | null>(null);
  const [teammates, setTeammates] = useState<TeammateMatch[]>([]);
  const [invitedUids, setInvitedUids] = useState<Set<string>>(new Set());
  const loading = hackathon !== null && loadedHackathonId !== hackathon.id;

  useEffect(() => {
    if (!hackathon) return;
    let isMounted = true;

    fetch(`/api/hackathons/${hackathon.id}/squad`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setTeammates(data.teammates || []);
          setLoadedHackathonId(hackathon.id);
        }
      })
      .catch((err) => {
        console.warn("Failed to load squad matches:", err);
        if (isMounted) {
          setTeammates([]);
          setLoadedHackathonId(hackathon.id);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [hackathon]);

  if (!hackathon) return null;

  const handleInvite = (uid: string) => {
    setInvitedUids((prev) => new Set([...prev, uid]));
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl h-full bg-[#0e0f17] border-l border-white/10 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-start justify-between bg-[#12131b]">
          <div>
            <div className="flex items-center gap-2 text-violet-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <UsersIcon className="w-4 h-4" />
              <span>Squad Match Engine</span>
            </div>
            <h2 className="text-xl font-bold font-serif text-white line-clamp-1">
              {hackathon.title}
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Collegiate builders with matched skills ({hackathon.skills?.slice(0, 3).join(", ") || "Engineering"})
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-rose-500 border-t-transparent animate-spin mx-auto" />
              <p className="text-xs text-neutral-400">Analyzing student profiles & skill tags...</p>
            </div>
          ) : teammates.length === 0 ? (
            <div className="py-16 text-center space-y-3 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
              <SparklesIcon className="w-8 h-8 text-neutral-500 mx-auto" />
              <p className="text-sm font-semibold text-white">No opted-in profiles found yet</p>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Encourage fellow collegiate builders to complete their PulsePoint profile and toggle &quot;Visible to students&quot; to appear in squad matching.
              </p>
            </div>
          ) : (
            teammates.map((mate) => {
              const isInvited = invitedUids.has(mate.uid);

              return (
                <div
                  key={mate.uid}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-violet-500/30 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {mate.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mate.avatarUrl}
                          alt={mate.fullName}
                          className="w-11 h-11 rounded-full object-cover border border-white/10"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-rose-600 to-purple-600 flex items-center justify-center font-bold text-white text-sm">
                          {mate.fullName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white">{mate.fullName}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/25">
                            {mate.matchScore}% Match
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 line-clamp-1">{mate.headline}</p>
                        <p className="text-[11px] text-neutral-500">
                          {mate.college} • {mate.branch}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleInvite(mate.uid)}
                      disabled={isInvited}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        isInvited
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default"
                          : "bg-violet-600 hover:bg-violet-500 text-white shadow-sm"
                      }`}
                    >
                      {isInvited ? (
                        <>
                          <CheckCircleIcon className="w-3.5 h-3.5" />
                          <span>Invited</span>
                        </>
                      ) : (
                        <span>Invite to Squad</span>
                      )}
                    </button>
                  </div>

                  {/* Shared Skills Highlighting */}
                  {mate.sharedSkills.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] uppercase font-bold text-neutral-500">Shared:</span>
                      {mate.sharedSkills.map((skill) => (
                        <span
                          key={skill}
                          className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Links */}
                  <div className="flex items-center gap-3 pt-1 text-[11px] text-neutral-400">
                    {mate.githubUrl && (
                      <a
                        href={mate.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-white flex items-center gap-1"
                      >
                        <span>GitHub</span>
                        <ExternalLinkIcon className="w-3 h-3" />
                      </a>
                    )}
                    {mate.linkedinUrl && (
                      <a
                        href={mate.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-white flex items-center gap-1"
                      >
                        <span>LinkedIn</span>
                        <ExternalLinkIcon className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-[#12131b] flex items-center justify-between text-xs text-neutral-400">
          <span>
            Target team size:{" "}
            {hackathon.team_size_min != null && hackathon.team_size_max != null
              ? `${hackathon.team_size_min}–${hackathon.team_size_max} members`
              : "Not listed"}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
