"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PulsePointWordmark, MenuIcon, CloseIcon } from "@/components/ui/icons";

interface ProfileSidebarProps {
  pathname: string;
  completion: number;
  userEmail?: string | null;
  onSignOut: () => void;
}

export function ProfileSidebar({
  pathname,
  completion,
  userEmail,
  onSignOut,
}: ProfileSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isEdit = pathname === "/profile/edit";
  const isSetup = pathname === "/profile/setup";
  const isView = pathname === "/profile";

  const navItems = [
    { label: "My profile", href: "/profile", active: isView },
    { label: "Edit profile", href: "/profile/edit", active: isEdit || isSetup },
    { label: "Back to home", href: "/", active: false },
  ];

  return (
    <>
      {/* Mobile Top Navigation Bar (visible below lg) */}
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#0c0d13]/90 px-4 py-3 backdrop-blur-md lg:hidden">
        <Link href="/" aria-label="PulsePoint Home">
          <PulsePointWordmark markClassName="w-6 h-6" className="text-base" />
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-rose-300">
            <span className="font-semibold">{completion}%</span>
            <span className="text-[10px] text-neutral-400">ready</span>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-neutral-300 hover:bg-white/5 hover:text-white"
            aria-label={mobileOpen ? "Close menu" : "Open workspace menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <CloseIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer (visible when open on mobile) */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="flex h-full w-72 flex-col border-r border-white/10 bg-[#0c0d13] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-8 flex items-center justify-between">
              <Link href="/" onClick={() => setMobileOpen(false)}>
                <PulsePointWordmark markClassName="w-7 h-7" className="text-lg" />
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1 text-neutral-400 hover:text-white"
                aria-label="Close menu"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.18em] text-neutral-500">
              Workspace
            </p>
            <nav className="space-y-1 text-sm">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block rounded-xl px-3 py-2.5 font-medium transition ${
                    item.active
                      ? "bg-rose-500/15 text-rose-200"
                      : "text-neutral-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-auto space-y-4 pt-6">
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <p className="text-xs font-medium text-neutral-300">Profile strength</p>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-rose-500 transition-all duration-300"
                    style={{ width: `${completion}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-neutral-400">{completion}% complete</p>
              </div>

              {userEmail && (
                <p className="truncate text-xs text-neutral-500">{userEmail}</p>
              )}

              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onSignOut();
                }}
                className="w-full rounded-xl border border-white/10 py-2.5 text-xs font-medium text-neutral-300 hover:bg-white/5 hover:text-white"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar (visible on lg+) */}
      <aside className="hidden w-64 shrink-0 border-r border-white/[0.07] bg-[#0c0d13] p-6 lg:flex lg:flex-col">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 text-lg font-bold">
          <PulsePointWordmark markClassName="w-7 h-7" className="text-lg" />
        </Link>

        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.18em] text-neutral-500">
          Workspace
        </p>
        <nav className="space-y-1 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-xl px-3 py-2.5 font-medium transition ${
                item.active
                  ? "bg-rose-500/15 text-rose-200"
                  : "text-neutral-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-4 pt-6">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <p className="text-xs font-medium text-neutral-300">Profile strength</p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-rose-500 transition-all duration-300"
                style={{ width: `${completion}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-neutral-400">{completion}% complete</p>
          </div>
        </div>
      </aside>
    </>
  );
}
