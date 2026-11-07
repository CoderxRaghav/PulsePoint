import React from "react";
import Link from "next/link";
import { SparklesIcon, ArrowRightIcon, UsersIcon, LayersIcon, ShieldIcon } from "@/components/ui/icons";
import { SpaceBackground } from "@/components/landing/space-background";

export function Hero() {
  return (
    <section className="relative min-h-[90vh] lg:min-h-screen flex flex-col justify-between pt-28 sm:pt-36 pb-12 sm:pb-20 overflow-hidden">
      {/* Decorative Video & Fallback Planet Canvas */}
      <SpaceBackground />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center flex flex-col items-center">
        {/* Announcement Pill with Liquid-Glass styling */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full liquid-glass-pill text-xs sm:text-sm font-medium text-neutral-200 mb-6 sm:mb-8 transition-transform hover:scale-[1.02] cursor-default">
          <SparklesIcon className="w-4 h-4 text-emerald-400" />
          <span>Find your people. Build your next idea.</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1] sm:leading-[1.15] max-w-3xl">
          Great ideas need{" "}
          <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-rose-500 to-rose-300 drop-shadow-[0_0_25px_rgba(225,29,72,0.3)]">
            the right teammates.
          </span>
        </h1>

        {/* Description */}
        <p className="mt-6 text-lg sm:text-xl text-neutral-300 max-w-2xl leading-relaxed font-normal">
          Discover complementary skills, form your team, find hackathons, and turn your next project into a shared achievement.
        </p>

        {/* Primary and Secondary Action CTAs */}
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link
            href="/sign-up"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-medium text-white btn-primary-glow text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070709]"
          >
            <span>Find Your Team</span>
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium text-neutral-200 hover:text-white glass-panel-subtle hover:bg-white/10 transition-colors text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <span>See How It Works</span>
          </a>
        </div>

        {/* Supporting Feature Value Badges */}
        <div className="mt-12 sm:mt-16 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-neutral-300">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 backdrop-blur-sm">
            <UsersIcon className="w-4 h-4 text-emerald-400" />
            <span>Explainable matches</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 backdrop-blur-sm">
            <LayersIcon className="w-4 h-4 text-violet-400" />
            <span>Team workspaces</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 backdrop-blur-sm">
            <ShieldIcon className="w-4 h-4 text-rose-400" />
            <span>AI-assisted planning</span>
          </div>
        </div>
      </div>
    </section>
  );
}

