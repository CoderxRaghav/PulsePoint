"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { PulsePointWordmark, GithubIcon, CloseIcon } from "@/components/ui/icons";

type ModalType = "privacy" | "guidelines" | "support" | null;

export function SiteFooter() {
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeModal) {
        setActiveModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeModal]);

  return (
    <footer className="relative border-t border-white/10 bg-[#070709] pt-16 pb-12 text-sm text-neutral-400">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-white/10">
          {/* Brand info (2 cols) */}
          <div className="md:col-span-2">
            <Link href="/" className="inline-block mb-4" aria-label="PulsePoint Home">
              <PulsePointWordmark markClassName="w-6 h-6" />
            </Link>
            <p className="text-neutral-400 max-w-md text-sm leading-relaxed mb-4">
              PulsePoint is a student teammate discovery and project collaboration platform designed to help builders find complementary collaborators and ship meaningful projects.
            </p>
            <p className="text-xs text-neutral-500">
              Phase 1 Frontend Milestone — Educational student platform in development.
            </p>
          </div>

          {/* Product links */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white mb-3">
              Platform
            </h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="#how-it-works"
                  className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 rounded"
                >
                  How It Works
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 rounded"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="#ai-assistance"
                  className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 rounded"
                >
                  AI Assistance
                </a>
              </li>
              <li>
                <Link
                  href="/hackathons"
                  className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 rounded"
                >
                  Hackathons
                </Link>
              </li>
            </ul>
          </div>

          {/* Project & Governance */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white mb-3">
              Governance & Code
            </h3>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => setActiveModal("privacy")}
                  className="hover:text-white transition-colors text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 rounded"
                >
                  Privacy (Draft)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActiveModal("guidelines")}
                  className="hover:text-white transition-colors text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 rounded"
                >
                  Community Guidelines (Draft)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActiveModal("support")}
                  className="hover:text-white transition-colors text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 rounded"
                >
                  Support
                </button>
              </li>
              <li>
                <a
                  href="https://github.com/CoderxRaghav/PulsePoint"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 rounded"
                >
                  <GithubIcon className="w-4 h-4" />
                  <span>GitHub Repository</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright and disclaimer */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <p>© 2026 PulsePoint. Open student collaboration platform.</p>
          <p>Built with Next.js, TypeScript & Tailwind CSS.</p>
        </div>
      </div>

      {/* Accessible Draft Policy & Support Modal Dialog */}
      {activeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-heading"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-lg rounded-2xl glass-panel p-6 sm:p-8 border border-white/10 shadow-2xl bg-[#0c0d14]">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-5 right-5 p-1 rounded-lg text-neutral-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              aria-label="Close dialog"
            >
              <CloseIcon className="w-5 h-5" />
            </button>

            {activeModal === "privacy" && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                  DRAFT POLICY — PLATFORM IN DEVELOPMENT
                </span>
                <h3 id="modal-heading" className="text-xl font-bold text-white mt-1 mb-4">
                  Privacy Policy (Working Draft)
                </h3>
                <div className="text-sm text-neutral-300 space-y-3 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
                  <p>
                    PulsePoint is currently in its initial frontend prototype phase. This draft policy outlines planned privacy principles:
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 text-neutral-400">
                    <li>Student contact information and real names will only be displayed according to chosen visibility settings.</li>
                    <li>No personal data or passwords are collected or stored in this frontend milestone.</li>
                    <li>Third-party telemetry is minimized to essential platform performance checks.</li>
                  </ul>
                  <p className="text-xs text-neutral-500 pt-2">
                    Note: Final legal policies are pending review and approval before full platform launch.
                  </p>
                </div>
              </div>
            )}

            {activeModal === "guidelines" && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  DRAFT GUIDELINES — PLATFORM IN DEVELOPMENT
                </span>
                <h3 id="modal-heading" className="text-xl font-bold text-white mt-1 mb-4">
                  Community Guidelines (Working Draft)
                </h3>
                <div className="text-sm text-neutral-300 space-y-3 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
                  <p>
                    PulsePoint aims to provide an inclusive, welcoming space for student builders of all experience levels:
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 text-neutral-400">
                    <li>Respect all collaborators regardless of skill level, background, or university affiliation.</li>
                    <li>Honest communication regarding skills, availability, and project commitments.</li>
                    <li>Zero tolerance for harassment, discrimination, or abusive conduct during team formation.</li>
                  </ul>
                  <p className="text-xs text-neutral-500 pt-2">
                    Note: Complete enforcement procedures and reporting guidelines will be published with backend milestone integration.
                  </p>
                </div>
              </div>
            )}

            {activeModal === "support" && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">
                  PROJECT CHANNELS
                </span>
                <h3 id="modal-heading" className="text-xl font-bold text-white mt-1 mb-4">
                  Project Support & Feedback
                </h3>
                <div className="text-sm text-neutral-300 space-y-3 leading-relaxed">
                  <p>
                    PulsePoint is being actively developed as an open source student initiative. For questions, bug reports, and roadmap discussions:
                  </p>
                  <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
                    <p className="text-xs font-mono text-neutral-300">
                      GitHub Repository:{" "}
                      <a
                        href="https://github.com/CoderxRaghav/PulsePoint"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-rose-400 hover:underline"
                      >
                        github.com/CoderxRaghav/PulsePoint
                      </a>
                    </p>
                    <p className="text-xs text-neutral-400">
                      Submit feature proposals or technical issues via GitHub Issues.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-white bg-white/10 hover:bg-white/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
