import React from "react";
import Link from "next/link";
import { PulsePointWordmark, SparklesIcon } from "@/components/ui/icons";

interface AuthBrandPanelProps {
  className?: string;
}

export function AuthBrandPanel({ className = "" }: AuthBrandPanelProps) {
  return (
    <div
      className={`relative overflow-hidden flex flex-col justify-between p-8 sm:p-10 lg:p-12 min-h-[340px] md:min-h-[640px] bg-[#07091e] text-white ${className}`}
    >
      {/* Dynamic Fluid Abstract Flowing-Wave Background (Pure CSS & SVG, zero heavy external assets) */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden" aria-hidden="true">
        {/* Deep base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#07091e] via-[#0c0f33] to-[#1a0a2a]" />

        {/* Ambient glowing color orbs */}
        <div className="absolute -top-1/4 -right-1/4 w-[420px] h-[420px] rounded-full bg-gradient-to-br from-purple-600/40 via-fuchsia-600/30 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -left-1/4 w-[480px] h-[480px] rounded-full bg-gradient-to-tr from-blue-600/40 via-cyan-500/25 to-transparent blur-3xl" />
        <div className="absolute -bottom-1/4 right-0 w-[500px] h-[500px] rounded-full bg-gradient-to-tl from-pink-600/40 via-purple-600/30 to-transparent blur-3xl" />

        {/* Layered Flowing Waves SVG */}
        <svg
          className="absolute inset-0 w-full h-full object-cover opacity-85 mix-blend-screen"
          viewBox="0 0 800 1000"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Wave Gradient: Electric Blue to Cyan */}
            <linearGradient id="wave-blue-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#06B6D4" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.6" />
            </linearGradient>

            {/* Wave Gradient: Purple to Violet */}
            <linearGradient id="wave-purple-violet" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#8B5CF6" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#C084FC" stopOpacity="0.5" />
            </linearGradient>

            {/* Wave Gradient: Vivid Magenta to Rose */}
            <linearGradient id="wave-magenta-rose" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#EC4899" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#F43F5E" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#DB2777" stopOpacity="0.9" />
            </linearGradient>

            {/* Deep Electric Swirl Gradient */}
            <linearGradient id="wave-deep-swirl" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#9333EA" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {/* Background undulating wave 1 (Deep Blue Swirl) */}
          <path
            d="M-100,200 C150,100 250,550 500,350 C750,150 700,600 900,450 L900,1100 L-100,1100 Z"
            fill="url(#wave-deep-swirl)"
            opacity="0.6"
          />

          {/* Flowing ribbon wave 2 (Purple Violet) */}
          <path
            d="M-50,450 C180,300 280,750 550,500 C800,280 750,780 880,700 L880,1100 L-50,1100 Z"
            fill="url(#wave-purple-violet)"
            opacity="0.7"
          />

          {/* Flowing ribbon wave 3 (Vivid Magenta Rose) */}
          <path
            d="M-80,650 C120,500 320,850 580,680 C820,520 780,900 920,820 L920,1100 L-80,1100 Z"
            fill="url(#wave-magenta-rose)"
            opacity="0.65"
          />

          {/* Accent fluid wave 4 (Electric Blue / Cyan) */}
          <path
            d="M-100,800 C200,650 350,980 620,820 C850,700 820,950 950,900 L950,1100 L-100,1100 Z"
            fill="url(#wave-blue-cyan)"
            opacity="0.8"
          />

          {/* Subtle light lines weaving through waves */}
          <path
            d="M-50,380 C200,260 300,700 560,460 C780,260 740,750 900,650"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1.5"
            strokeDasharray="4 6"
          />
          <path
            d="M-60,580 C150,440 340,800 600,620 C800,480 800,850 920,780"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="2"
          />
        </svg>

        {/* Readability dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/30 pointer-events-none" />
      </div>

      {/* Top Header: Brand Wordmark */}
      <div className="relative z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          aria-label="Back to PulsePoint Homepage"
        >
          <PulsePointWordmark markClassName="w-6 h-6" className="text-xl" />
        </Link>
      </div>

      {/* Bottom Content: Headline, Supporting Text, and Caption */}
      <div className="relative z-10 pt-16 sm:pt-24 max-w-lg">
        {/* Decorative Pill Caption */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-xs font-medium text-rose-200 mb-4 sm:mb-6 shadow-sm">
          <SparklesIcon className="w-3.5 h-3.5 text-rose-400" />
          <span>Where ideas meet their perfect team.</span>
        </div>

        {/* Headline */}
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight mb-3 sm:mb-4">
          Find Your People. <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-300 via-fuchsia-300 to-indigo-200">
            Build What Matters.
          </span>
        </h2>

        {/* Supporting Copy */}
        <p className="text-sm sm:text-base text-neutral-200/90 leading-relaxed font-normal">
          Bring your skills and ideas together. Discover teammates, form a team, and start building your next project.
        </p>

        {/* Feature Highlights Pills */}
        <div className="mt-6 flex flex-wrap gap-2 text-xs text-white/80">
          <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 backdrop-blur-sm">
            Explainable Matching
          </span>
          <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 backdrop-blur-sm">
            Student Hackathon Squads
          </span>
          <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 backdrop-blur-sm">
            Team Workspaces
          </span>
        </div>
      </div>
    </div>
  );
}

