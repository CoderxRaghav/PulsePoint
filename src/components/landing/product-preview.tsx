"use client";

import React, { useState } from "react";
import { CheckCircleIcon, ClockIcon, UsersIcon, SparklesIcon } from "@/components/ui/icons";

export function ProductPreview() {
  const [activeTab, setActiveTab] = useState<"workspace" | "matching" | "tasks">("workspace");

  return (
    <section className="relative z-20 max-w-6xl mx-auto px-4 sm:px-6 -mt-8 sm:-mt-12 mb-24 sm:mb-32">
      {/* Decorative ambient underglow */}
      <div className="absolute inset-x-12 -top-10 h-32 bg-radial from-rose-500/15 via-violet-600/10 to-transparent blur-3xl pointer-events-none" />

      {/* Main glass frame wrapper */}
      <div className="relative rounded-3xl glass-panel p-4 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-white/10">
        {/* Header bar of preview frame */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-white/10 gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold tracking-wider uppercase text-neutral-400">
              Illustrative product preview
            </span>
          </div>

          {/* Interactive tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/10 self-start sm:self-auto" role="tablist" aria-label="Product preview views">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "workspace"}
              onClick={() => setActiveTab("workspace")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                activeTab === "workspace"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Workspace Overview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "matching"}
              onClick={() => setActiveTab("matching")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                activeTab === "matching"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Match Breakdown
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "tasks"}
              onClick={() => setActiveTab("tasks")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                activeTab === "tasks"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Tasks & Milestones
            </button>
          </div>
        </div>

        {/* Tab content area */}
        <div className="pt-6">
          {activeTab === "workspace" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Main Team Workspace Card (8 cols) */}
              <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl bg-neutral-900/70 border border-white/10 p-5 sm:p-6 shadow-inner">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                      Hackathon Project Squad
                    </span>
                    <span className="text-xs text-neutral-400">Team 3 of 4 spots filled</span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                    Campus Sustainability Platform
                  </h3>
                  <p className="text-sm text-neutral-300 leading-relaxed mb-6">
                    Building an intelligent waste-tracking and surplus food redistribution network connecting dining halls, campus pantries, and student organizations.
                  </p>

                  <div className="mb-6 p-4 rounded-xl bg-black/40 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                        Target Open Role
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/20 font-medium">
                        Backend Developer
                      </span>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      Need experience with REST APIs, PostgreSQL schemas, and containerization.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-400">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="w-4 h-4 text-neutral-400" />
                    <span>Lead: Sarah M. (Design), David K. (Frontend)</span>
                  </div>
                  <span className="text-neutral-500">HackMIT 2026 Candidate</span>
                </div>
              </div>

              {/* Side Column: Suggested Teammate + Tasks (5 cols) */}
              <div className="lg:col-span-5 flex flex-col gap-5">
                {/* Suggested Teammate Card */}
                <div className="rounded-2xl bg-neutral-900/70 border border-white/10 p-5 shadow-inner">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <SparklesIcon className="w-4 h-4 text-rose-400" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                        Suggested Teammate
                      </span>
                    </div>
                    <span className="text-xs px-2.5 py-0.5 rounded-md bg-rose-500/15 text-rose-300 font-semibold border border-rose-500/30">
                      Match ranking: 86/100
                    </span>
                  </div>

                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rose-500 to-violet-600 flex items-center justify-center font-bold text-sm text-white shrink-0">
                      AR
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">Alex Rivera</h4>
                      <p className="text-xs text-neutral-400">Computer Science &apos;26 • Backend focus</p>
                    </div>
                  </div>

                  {/* Matching Explanation */}
                  <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-xs text-neutral-300 leading-relaxed mb-3">
                    <p className="font-medium text-neutral-200 mb-1">Why this match?</p>
                    <p className="text-neutral-400">
                      Covers your backend role, shares your sustainability interest, and overlaps with your weekend availability.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-white/5 text-neutral-300 border border-white/10">Python</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-neutral-300 border border-white/10">PostgreSQL</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-neutral-300 border border-white/10">FastAPI</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-neutral-300 border border-white/10">Docker</span>
                  </div>
                </div>

                {/* Compact Milestone/Task Card */}
                <div className="rounded-2xl bg-neutral-900/70 border border-white/10 p-5 shadow-inner">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                      Sprint Milestones
                    </span>
                    <span className="text-xs text-neutral-400">Phase 1</span>
                  </div>

                  <ul className="space-y-2.5 text-xs">
                    <li className="flex items-center justify-between p-2.5 rounded-lg bg-black/30 border border-white/5">
                      <div className="flex items-center gap-2">
                        <CheckCircleIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-neutral-200 line-through text-neutral-400">Define API contract</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-medium border border-emerald-500/25">
                        Done
                      </span>
                    </li>
                    <li className="flex items-center justify-between p-2.5 rounded-lg bg-black/30 border border-white/5">
                      <div className="flex items-center gap-2">
                        <ClockIcon className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-neutral-200 font-medium">Implement team requests</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-medium border border-amber-500/25">
                        In progress
                      </span>
                    </li>
                    <li className="flex items-center justify-between p-2.5 rounded-lg bg-black/30 border border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border border-neutral-600 shrink-0 inline-block" />
                        <span className="text-neutral-300">Review membership permissions</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 text-[10px] font-medium border border-white/10">
                        To do
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === "matching" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-2">
              <div className="p-5 rounded-2xl bg-neutral-900/70 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-emerald-400 uppercase">Skill Gap Coverage</span>
                  <span className="text-xs font-bold text-white">92%</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed mb-3">
                  Alex brings Python, PostgreSQL, and Docker experience which directly addresses the team&apos;s missing backend component.
                </p>
                <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-[92%]" />
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-neutral-900/70 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-rose-400 uppercase">Domain & Interest</span>
                  <span className="text-xs font-bold text-white">88%</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed mb-3">
                  Both candidate and team have selected Campus Sustainability, Climate Tech, and Circular Economy as primary project themes.
                </p>
                <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full w-[88%]" />
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-neutral-900/70 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-violet-400 uppercase">Time & Availability</span>
                  <span className="text-xs font-bold text-white">80%</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed mb-3">
                  Overlapping weekend working blocks and compatible Eastern Time schedules during the HackMIT 48-hour sprint.
                </p>
                <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full w-[80%]" />
                </div>
              </div>
            </div>
          )}

          {activeTab === "tasks" && (
            <div className="p-4 rounded-2xl bg-neutral-900/70 border border-white/10">
              <h4 className="text-sm font-semibold text-white mb-3">Detailed Hackathon Sprint Tasks</h4>
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white">Setup Postgres database schemas & migrations</p>
                    <p className="text-[11px] text-neutral-400">Assigned: Alex Rivera • Due: Friday 10 PM</p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-xs font-medium border border-emerald-500/25">Done</span>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white">Build dining hall inventory sync endpoint</p>
                    <p className="text-[11px] text-neutral-400">Assigned: Alex Rivera • Due: Saturday 2 PM</p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 text-xs font-medium border border-amber-500/25">In progress</span>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white">Connect Next.js frontend to API gateway</p>
                    <p className="text-[11px] text-neutral-400">Assigned: David K. • Due: Saturday 6 PM</p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 text-xs font-medium border border-white/10">To do</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

