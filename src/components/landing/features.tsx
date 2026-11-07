import React from "react";
import {
  UsersIcon,
  SparklesIcon,
  BookmarkIcon,
  LayersIcon,
  BellIcon,
  ShieldIcon,
} from "@/components/ui/icons";

export function Features() {
  const featureList = [
    {
      title: "Explainable teammate recommendations",
      description:
        "Understand exactly why a teammate is suggested: matching skill gaps, compatible timezone blocks, and verified project interests.",
      icon: SparklesIcon,
      accent: "text-rose-400 group-hover:text-rose-300",
      borderAccent: "group-hover:border-rose-500/30",
    },
    {
      title: "Invitations and join-request management",
      description:
        "Structured application flows with role criteria, member reviews, and transparent join decisions without messy group chats.",
      icon: UsersIcon,
      accent: "text-emerald-400 group-hover:text-emerald-300",
      borderAccent: "group-hover:border-emerald-500/30",
    },
    {
      title: "Hackathon discovery and bookmarks",
      description:
        "Browse verified collegiate and open hackathons, save target deadlines, and assemble custom squads around hackathon tracks.",
      icon: BookmarkIcon,
      accent: "text-violet-400 group-hover:text-violet-300",
      borderAccent: "group-hover:border-violet-500/30",
    },
    {
      title: "Team tasks, milestones, and dependencies",
      description:
        "Lightweight sprint organization built for fast-paced student projects, with assignees, status tags, and clear delivery dates.",
      icon: LayersIcon,
      accent: "text-amber-400 group-hover:text-amber-300",
      borderAccent: "group-hover:border-amber-500/30",
    },
    {
      title: "Activity history and in-app notifications",
      description:
        "Real-time notifications for team invitations, application status changes, and milestone handoffs so everyone stays aligned.",
      icon: BellIcon,
      accent: "text-sky-400 group-hover:text-sky-300",
      borderAccent: "group-hover:border-sky-500/30",
    },
    {
      title: "Privacy controls, blocking, and reporting",
      description:
        "Strict student privacy defaults: control profile discoverability, contact preferences, and access safety reporting at any time.",
      icon: ShieldIcon,
      accent: "text-teal-400 group-hover:text-teal-300",
      borderAccent: "group-hover:border-teal-500/30",
    },
  ];

  return (
    <section id="features" className="relative py-20 sm:py-28 scroll-mt-20 border-t border-white/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-neutral-400 mb-3">
            <span>Product preview — platform in development</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
            Built for how student builders actually collaborate
          </h2>
          <p className="text-base sm:text-lg text-neutral-300">
            Everything your team needs to find missing capabilities, maintain momentum, and deliver high-impact projects.
          </p>
        </div>

        {/* 6 Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featureList.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className={`group relative rounded-2xl glass-panel p-6 sm:p-7 flex flex-col justify-between border border-white/10 ${feature.borderAccent} transition-all duration-200 hover:-translate-y-1 shadow-md`}
              >
                <div>
                  <div className="mb-4 inline-flex p-3 rounded-xl bg-white/5 border border-white/10">
                    <Icon className={`w-5 h-5 ${feature.accent} transition-colors`} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-neutral-100">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-neutral-300 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

