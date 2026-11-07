import React from "react";
import Link from "next/link";
import { ArrowRightIcon, BookmarkIcon } from "@/components/ui/icons";

export function FinalCta() {
  return (
    <section className="relative py-20 sm:py-28 overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="relative rounded-3xl glass-panel p-8 sm:p-14 text-center border border-white/10 overflow-hidden shadow-2xl">
          {/* Subtle background glow */}
          <div className="absolute inset-0 bg-radial from-rose-500/15 via-violet-600/10 to-transparent blur-3xl pointer-events-none" />

          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-rose-400 mb-3">
            Ready to Build?
          </span>

          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white max-w-2xl mx-auto mb-5 leading-tight">
            Your next project starts with the right people.
          </h2>

          <p className="text-base sm:text-lg text-neutral-300 max-w-xl mx-auto mb-8 sm:mb-10 leading-relaxed">
            Stop searching through disorganized group chats. Discover motivated student teammates with complementary skills and start building together.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-medium text-white btn-primary-glow text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070709]"
            >
              <span>Create Your Profile</span>
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
            <Link
              href="/hackathons"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-medium text-neutral-200 hover:text-white glass-panel-subtle hover:bg-white/10 transition-colors text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <BookmarkIcon className="w-4 h-4 text-neutral-400" />
              <span>Explore Hackathons</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

