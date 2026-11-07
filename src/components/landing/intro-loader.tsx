"use client";

import React, { useEffect, useState } from "react";

interface IntroLoaderProps {
  onIntroComplete?: () => void;
}

const STORAGE_KEY = "pulsepoint_preloader_seen_v2";

export function IntroLoader({ onIntroComplete }: IntroLoaderProps) {
  const [stage, setStage] = useState<"idle" | "drawing" | "revealed" | "fading" | "hidden">("idle");
  const [isLineDrawn, setIsLineDrawn] = useState(false);

  useEffect(() => {
    // 1. Session check: Run only once per browser tab session
    let alreadySeen = false;
    try {
      alreadySeen = Boolean(sessionStorage.getItem(STORAGE_KEY));
    } catch {
      // Safe fallback if sessionStorage is blocked
    }

    // 2. Reduced motion check
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (alreadySeen || prefersReducedMotion) {
      try {
        sessionStorage.setItem(STORAGE_KEY, "true");
      } catch {}
      if (onIntroComplete) onIntroComplete();
      return;
    }

    // 3. Mount preloader and trigger pulse line draw
    const mountTimer = setTimeout(() => {
      setStage("drawing");
    }, 10);

    const drawTimer = setTimeout(() => {
      setIsLineDrawn(true);
    }, 40);

    // 4. Reveal nodes and wordmark once pulse line finishes drawing (~450ms)
    const revealTimer = setTimeout(() => {
      setStage("revealed");
    }, 450);

    // 5. Begin fade & scale exit (~1.05s)
    const fadeTimer = setTimeout(() => {
      setStage("fading");
      try {
        sessionStorage.setItem(STORAGE_KEY, "true");
      } catch {}
    }, 1050);

    // 6. Complete removal from DOM (~1.5s, hard capped <= 1.8s)
    const finishTimer = setTimeout(() => {
      setStage("hidden");
      if (onIntroComplete) onIntroComplete();
    }, 1500);

    // 7. Hard safety dismissal timeout
    const safetyTimer = setTimeout(() => {
      setStage("hidden");
      if (onIntroComplete) onIntroComplete();
    }, 1800);

    return () => {
      clearTimeout(mountTimer);
      clearTimeout(drawTimer);
      clearTimeout(revealTimer);
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
      clearTimeout(safetyTimer);
    };
  }, [onIntroComplete]);

  if (stage === "idle" || stage === "hidden") {
    return null;
  }

  const isFading = stage === "fading";
  const nodesVisible = stage === "revealed" || stage === "fading";

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#070709] transition-all duration-500 ease-out ${
        isFading ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"
      }`}
    >
      <div className="relative flex flex-col items-center text-center px-4 max-w-xs">
        {/* Soft crimson and violet ambient glow */}
        <div className="absolute -inset-16 bg-radial from-rose-500/25 via-violet-600/15 to-transparent blur-3xl pointer-events-none rounded-full" />

        {/* PulsePoint Brand Icon Box */}
        <div className="relative mb-5 p-5 rounded-2xl bg-neutral-900/70 border border-white/10 shadow-2xl backdrop-blur-md flex items-center justify-center">
          <svg
            width="88"
            height="44"
            viewBox="0 0 100 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="overflow-visible"
          >
            <defs>
              <linearGradient id="preloader-pulse-grad" x1="6" y1="24" x2="64" y2="24" gradientUnits="userSpaceOnUse">
                <stop stopColor="#E11D48" />
                <stop offset="0.6" stopColor="#F43F5E" />
                <stop offset="1" stopColor="#FB7185" />
              </linearGradient>
              <filter id="preloader-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#E11D48" floodOpacity="0.6" />
              </filter>
            </defs>

            {/* Pulse Line - Animated drawing once */}
            <path
              d="M 6 24 H 20 L 26 8 L 36 40 L 46 14 L 52 28 H 64"
              stroke="url(#preloader-pulse-grad)"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#preloader-glow)"
              style={{
                strokeDasharray: 120,
                strokeDashoffset: isLineDrawn ? 0 : 120,
                transition: "stroke-dashoffset 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />

            {/* Connecting Links to Three Collaboration Nodes */}
            <g
              className={`transition-opacity duration-300 ease-out ${
                nodesVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <line
                x1="64"
                y1="28"
                x2="84"
                y2="14"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="1.4"
                strokeDasharray="2 2"
              />
              <line
                x1="64"
                y1="28"
                x2="84"
                y2="40"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="1.4"
                strokeDasharray="2 2"
              />
              <line
                x1="84"
                y1="14"
                x2="84"
                y2="40"
                stroke="rgba(139,92,246,0.4)"
                strokeWidth="1.2"
                strokeDasharray="2 2"
              />
            </g>

            {/* Three Connected Collaboration Nodes */}
            <g
              className={`transition-all duration-300 ease-out ${
                nodesVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"
              }`}
              style={{ transformOrigin: "74px 28px" }}
            >
              {/* Hub Node (Crimson) */}
              <circle cx="64" cy="28" r="3.5" fill="#E11D48" />
              <circle cx="64" cy="28" r="6" stroke="#E11D48" strokeWidth="1" opacity="0.4" />

              {/* Node 2: Teammate (Mint) */}
              <circle cx="84" cy="14" r="3.5" fill="#10B981" />
              <circle cx="84" cy="14" r="6" stroke="#10B981" strokeWidth="1" opacity="0.4" />

              {/* Node 3: Teammate (Violet) */}
              <circle cx="84" cy="40" r="3.5" fill="#8B5CF6" />
              <circle cx="84" cy="40" r="6" stroke="#8B5CF6" strokeWidth="1" opacity="0.4" />
            </g>
          </svg>
        </div>

        {/* PulsePoint Wordmark */}
        <div
          className={`flex items-center justify-center transition-all duration-400 ease-out ${
            nodesVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
        >
          <span className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Pulse<span className="text-rose-500">Point</span>
          </span>
        </div>
      </div>
    </div>
  );
}
