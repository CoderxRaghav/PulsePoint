"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { PulsePointWordmark, MenuIcon, CloseIcon } from "@/components/ui/icons";

export function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Close mobile menu on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { label: "How It Works", href: "#how-it-works" },
    { label: "Features", href: "#features" },
    { label: "AI Assistance", href: "#ai-assistance" },
  ];

  const handleLinkClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 px-4 sm:px-6 pt-3 sm:pt-4 pointer-events-none">
      <div className="max-w-6xl mx-auto flex items-center justify-between rounded-2xl glass-nav px-4 sm:px-6 py-2.5 sm:py-3 pointer-events-auto shadow-2xl transition-all duration-200">
        {/* Brand */}
        <Link
          href="/"
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 py-1"
          aria-label="PulsePoint Home"
        >
          <PulsePointWordmark markClassName="w-6 h-6 sm:w-7 sm:h-7" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2" aria-label="Main Navigation">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-neutral-300 hover:text-white px-3.5 py-1.5 rounded-lg transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA actions */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm font-medium text-neutral-300 hover:text-white px-3.5 py-1.5 rounded-lg transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="text-sm font-medium text-white px-4 py-1.5 rounded-xl btn-primary-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070709]"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-neutral-300 hover:text-white rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav"
            aria-label={mobileMenuOpen ? "Close menu" : "Open navigation menu"}
          >
            {mobileMenuOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Accessible Mobile Menu Overlay & Panel */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav"
          ref={menuRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Menu"
          className="md:hidden fixed inset-0 top-[70px] z-50 bg-[#070709]/95 backdrop-blur-2xl p-6 flex flex-col justify-between pointer-events-auto border-t border-white/10 animate-in fade-in duration-200"
        >
          <nav className="flex flex-col gap-2 pt-4" aria-label="Mobile Navigation">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={handleLinkClick}
                className="text-lg font-medium text-neutral-200 hover:text-white px-4 py-3 rounded-xl hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex flex-col gap-3 pb-8 pt-6 border-t border-white/10">
            <Link
              href="/sign-in"
              onClick={handleLinkClick}
              className="w-full text-center py-3 text-base font-medium text-neutral-200 hover:text-white rounded-xl bg-white/5 border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              onClick={handleLinkClick}
              className="w-full text-center py-3 text-base font-medium text-white rounded-xl btn-primary-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

