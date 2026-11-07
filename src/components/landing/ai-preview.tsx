"use client";

import React, { useState } from "react";
import { SparklesIcon, CheckCircleIcon, ArrowRightIcon } from "@/components/ui/icons";

export function AiPreview() {
  const [activeStep, setActiveStep] = useState<0 | 1 | 2 | 3>(0);

  const workflowSteps = [
    {
      id: "idea",
      label: "1. Idea",
      title: "Input your raw concept",
      content:
        '“We want to build a lightweight campus food redistribution platform where campus dining halls alert student dorm pantries before daily food pickups.”',
      detail: "Student defines the core problem and intended users in plain words.",
    },
    {
      id: "plan",
      label: "2. Suggested plan",
      title: "Generated structured project outline",
      content:
        "Architecture: Next.js frontend, Node.js API, PostgreSQL database. Core features: Role auth, inventory tracker, push notifications.",
      detail: "AI identifies missing architectural layers and required technical roles.",
    },
    {
      id: "review",
      label: "3. Review & tweak",
      title: "Inspect, modify, or reject steps",
      content:
        "Team removes complex SMS gateways in favor of simple webhooks. Estimated sprint timeline adjusted from 3 weeks to a 48h hackathon scope.",
      detail: "Human team members retain total editorial control over the roadmap.",
    },
    {
      id: "save",
      label: "4. Save to Workspace",
      title: "Synced directly to team tasks",
      content:
        "5 backlog tasks and 2 milestones automatically populated into the team's shared workspace with assigned roles.",
      detail: "Ready for your team to assign and execute without manual data entry.",
    },
  ];

  return (
    <section id="ai-assistance" className="relative py-20 sm:py-28 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Subtle ambient violet backdrop glow */}
        <div className="absolute inset-x-20 top-1/2 -translate-y-1/2 h-64 bg-radial from-violet-600/15 via-rose-500/10 to-transparent blur-3xl pointer-events-none" />

        {/* Outer Glass Container */}
        <div className="relative rounded-3xl glass-panel p-6 sm:p-10 lg:p-12 border border-violet-500/20 shadow-2xl overflow-hidden">
          {/* Subtle top edge liquid-glass highlight */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Copy & Value Proposition (5 cols) */}
            <div className="lg:col-span-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/30 text-xs font-semibold text-violet-300 mb-4">
                <SparklesIcon className="w-3.5 h-3.5 text-violet-400" />
                <span>AI-Assisted Scaffolding</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4 leading-tight">
                From a rough idea to a clearer next step.
              </h2>

              <p className="text-base text-neutral-300 mb-6 leading-relaxed">
                PulsePoint provides context-aware guidance designed for hackathon squads and student projects. Transform unstructured brainstorms into actionable execution plans.
              </p>

              {/* Three concise capabilities */}
              <div className="space-y-3.5 mb-6">
                <div className="flex items-start gap-3">
                  <div className="p-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0 mt-0.5">
                    <CheckCircleIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Generate a project plan</h3>
                    <p className="text-xs text-neutral-400">Outline architecture, required dependencies, and missing squad roles.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-400 shrink-0 mt-0.5">
                    <CheckCircleIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Break milestones into editable tasks</h3>
                    <p className="text-xs text-neutral-400">Turn broad deliverables into sprint-sized issues with realistic difficulty.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 shrink-0 mt-0.5">
                    <CheckCircleIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Get context-aware technical guidance</h3>
                    <p className="text-xs text-neutral-400">Receive architectural trade-off recommendations tailored to your stack.</p>
                  </div>
                </div>
              </div>

              {/* Guardrail Guarantee */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 text-xs text-neutral-300">
                <span className="font-semibold text-rose-400">Student Guarantee: </span>
                AI suggestions stay editable. You decide what gets saved.
              </div>
            </div>

            {/* Right Column: Interactive Step Preview (7 cols) */}
            <div className="lg:col-span-7 rounded-2xl bg-black/50 border border-white/10 p-5 sm:p-6 shadow-inner">
              {/* Stepper Navigation */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5 overflow-x-auto gap-2">
                {workflowSteps.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveStep(idx as 0 | 1 | 2 | 3)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                      activeStep === idx
                        ? "bg-violet-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.5)]"
                        : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Step Detail Card */}
              <div className="min-h-[220px] flex flex-col justify-between p-5 rounded-xl bg-neutral-900/60 border border-white/10">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">
                      Step {activeStep + 1} of 4
                    </span>
                    <span className="text-[11px] text-neutral-400 font-mono">
                      {workflowSteps[activeStep].id.toUpperCase()} PREVIEW
                    </span>
                  </div>

                  <h4 className="text-lg font-bold text-white mb-2">
                    {workflowSteps[activeStep].title}
                  </h4>

                  <div className="p-3.5 rounded-lg bg-black/50 border border-white/5 font-mono text-xs text-neutral-200 leading-relaxed mb-3">
                    {workflowSteps[activeStep].content}
                  </div>

                  <p className="text-xs text-neutral-400">
                    {workflowSteps[activeStep].detail}
                  </p>
                </div>

                {/* Step controls */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/10 text-xs">
                  <span className="text-neutral-400">
                    Click through the four stages of AI-assisted planning.
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveStep(((activeStep + 1) % 4) as 0 | 1 | 2 | 3)
                    }
                    className="inline-flex items-center gap-1.5 text-violet-300 hover:text-white font-medium py-1 px-2.5 rounded-md hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  >
                    <span>Next step</span>
                    <ArrowRightIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

