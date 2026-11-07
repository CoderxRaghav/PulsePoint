import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { PulsePointWordmark, ArrowRightIcon, BookmarkIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Hackathons (Placeholder) — PulsePoint",
  description: "Hackathon discovery placeholder page for PulsePoint student collaboration platform.",
};

export default function HackathonsPage() {
  return (
    <main className="min-h-screen flex flex-col justify-between bg-[#070709] px-4 py-8">
      <div className="max-w-md mx-auto w-full pt-12 sm:pt-20">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block" aria-label="PulsePoint Home">
            <PulsePointWordmark markClassName="w-8 h-8" className="text-2xl" />
          </Link>
        </div>

        <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-white/10 shadow-2xl text-center">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center mx-auto mb-4 text-violet-400">
            <BookmarkIcon className="w-6 h-6" />
          </div>

          <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">
            Frontend Milestone 1
          </span>

          <h1 className="text-2xl font-bold text-white mt-1 mb-3">
            Hackathons Directory in Development
          </h1>

          <p className="text-sm text-neutral-300 leading-relaxed mb-6">
            The hackathon discovery directory, team formation channels, and event bookmarking features will be introduced in subsequent roadmap phases. No event registrations are processed here yet.
          </p>

          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-xs text-neutral-400 text-left mb-6">
            <p className="font-semibold text-neutral-300 mb-1">Planned Hackathon Capabilities:</p>
            <ul className="list-disc pl-4 space-y-1 text-neutral-400">
              <li>Curated list of verified major student hackathons</li>
              <li>Filter by virtual, in-person, prize tracks, and themes</li>
              <li>One-click squad assembly targeting specific hackathons</li>
            </ul>
          </div>

          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-white btn-primary-glow text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <span>Back to PulsePoint</span>
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <footer className="text-center text-xs text-neutral-500 pb-4">
        © 2026 PulsePoint • Student Platform Prototype
      </footer>
    </main>
  );
}
