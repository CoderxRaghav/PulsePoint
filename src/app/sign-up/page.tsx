import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { ArrowRightIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Create Account — PulsePoint",
  description: "Create your student builder profile on PulsePoint and start discovering teammates.",
};

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-[#070709] py-8 sm:py-12 lg:py-16 px-4 sm:px-6 flex flex-col justify-center items-center relative overflow-x-hidden selection:bg-rose-500/30 selection:text-white">
      {/* Subtle ambient backdrop glows */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-radial from-violet-600/10 via-rose-600/5 to-transparent blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Top minimal navigation return link */}
      <div className="w-full max-w-5xl mb-4 sm:mb-6 flex items-center justify-between z-10 px-1">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded py-1"
        >
          <span className="rotate-180 inline-block">
            <ArrowRightIcon className="w-3.5 h-3.5" />
          </span>
          <span>Back to PulsePoint</span>
        </Link>
        <span className="text-[11px] font-mono tracking-wider text-neutral-400 uppercase">
          Student Platform
        </span>
      </div>

      {/* Centered Split-Screen Authentication Card */}
      <div className="w-full max-w-5xl rounded-3xl bg-white border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden grid grid-cols-1 md:grid-cols-2 relative z-10">
        {/* Left Panel: Vivid Abstract Flowing-Wave Brand Story (~50% width) */}
        <AuthBrandPanel />

        {/* Right Panel: Clean White Form Surface (~50% width) */}
        <div className="bg-white p-7 sm:p-10 lg:p-12 flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-100">
          <SignUpForm />
        </div>
      </div>

      {/* Subtle Bottom Footer */}
      <footer className="mt-8 text-center text-xs text-neutral-400 z-10">
        © 2026 PulsePoint • Student Teammate Discovery & Project Collaboration
      </footer>
    </main>
  );
}
