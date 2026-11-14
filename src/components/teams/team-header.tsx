"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function TeamHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-charcoal-700 bg-space-black/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/teams" className="team-heading text-xl font-bold tracking-tight text-warm-white">
          PulsePoint <span className="text-crimson">Teams</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4" aria-label="Team navigation">
          <Link className="hidden text-sm font-medium text-warm-white-muted transition hover:text-warm-white sm:inline" href="/teams">
            Join a Team
          </Link>
          <Link className="hidden text-sm font-medium text-warm-white-muted transition hover:text-warm-white sm:inline" href="/hackathons">
            Hackathons
          </Link>
          <Link className="rounded-lg bg-crimson px-3 py-2 text-sm font-semibold text-white transition hover:bg-crimson-hover" href="/teams/new">
            Create a Team
          </Link>
          <Link className="rounded-lg px-3 py-2 text-sm font-medium text-warm-white-muted transition hover:bg-charcoal-800 hover:text-warm-white" href="/teams/mine">
            My Teams
          </Link>
          <Link className="hidden text-sm font-medium text-warm-white-muted transition hover:text-warm-white sm:inline" href="/profile">
            Profile
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
