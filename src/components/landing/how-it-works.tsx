import React from "react";
import { UsersIcon, SparklesIcon, LayersIcon } from "@/components/ui/icons";

export function HowItWorks() {
  const steps = [
    {
      step: "01",
      title: "Create your profile",
      description:
        "Highlight your technical skills, preferred roles, project interests, and upcoming hackathon goals.",
      icon: UsersIcon,
      badgeColor: "text-rose-400 border-rose-500/20 bg-rose-500/10",
    },
    {
      step: "02",
      title: "Discover complementary teammates",
      description:
        "Get transparent, explainable recommendations that match based on genuine skill gaps, availability, and interests.",
      icon: SparklesIcon,
      badgeColor: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
    },
    {
      step: "03",
      title: "Form a team and start building",
      description:
        "Establish your team workspace, align on shared milestones, track tasks, and turn ideas into working projects.",
      icon: LayersIcon,
      badgeColor: "text-violet-400 border-violet-500/20 bg-violet-500/10",
    },
  ];

  return (
    <section id="how-it-works" className="relative py-20 sm:py-28 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 sm:mb-20">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-500">
            Simple Workflow
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mt-2 mb-4">
            How PulsePoint Works
          </h2>
          <p className="text-base sm:text-lg text-neutral-300">
            A focused collaboration platform built to take student ideas from first concept to a formed, capable team.
          </p>
        </div>

        {/* 3 Step Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {steps.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="relative rounded-3xl glass-panel p-6 sm:p-8 flex flex-col justify-between border border-white/10 hover:border-white/20 transition-all duration-300 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-bold tracking-widest text-neutral-500 font-mono">
                      STEP {item.step}
                    </span>
                    <span className={`p-2.5 rounded-xl border ${item.badgeColor}`}>
                      <Icon className="w-5 h-5" />
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-rose-400 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-neutral-300 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Tactile Claymorphic Visual Detail on Step 2 (Matchmaking Node) */}
                {index === 1 && (
                  <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-center">
                    <div className="clay-node px-4 py-2.5 flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
                      <div className="h-0.5 w-6 bg-gradient-to-r from-rose-500 to-emerald-400 rounded-full" />
                      <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                      <span className="text-[11px] font-semibold text-neutral-200 tracking-wide pl-1">
                        Node Affinity
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

