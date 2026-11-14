"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { NormalizedHackathon } from "@/lib/aggregator/types";
import { SOURCE_ACCESS_POLICY } from "@/lib/aggregator/source-policy";
import { HackathonHero } from "@/components/hackathons/hackathon-hero";
import { HackathonFilters } from "@/components/hackathons/hackathon-filters";
import { HackathonCard } from "@/components/hackathons/hackathon-card";
import { HackathonSquadDrawer } from "@/components/hackathons/hackathon-squad-drawer";
import {
  PulsePointWordmark,
  SparklesIcon,
  BookmarkIcon,
} from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface HackathonApiResponse {
  hackathons: NormalizedHackathon[];
  total: number;
  stats: {
    totalActive: number;
    totalCount: number;
    onlineCount: number;
    inPersonCount: number;
    formattedPrizeSum: string;
    totalPrizeUsd: number;
    uniqueOrganizers: number;
    sources: string[];
  };
  sync: {
    status: string;
    lastSyncCompletedAt: string | null;
    totalDiscovered: number;
  };
}

async function loadSavedIds(user: User): Promise<string[]> {
  const token = await user.getIdToken();
  const response = await fetch("/api/hackathons/saved", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Failed to load saved hackathons.");
  const data = await response.json();
  return Array.isArray(data.savedIds) ? data.savedIds : [];
}

export default function HackathonsPage() {
  const aggregatorActive = Object.values(SOURCE_ACCESS_POLICY).some(
    (source) => source.status === "authorized"
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hackathons, setHackathons] = useState<NormalizedHackathon[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [statsAvailable, setStatsAvailable] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTheme, setSelectedTheme] = useState("all");
  const [selectedSource, setSelectedSource] = useState("all");
  const [selectedMode, setSelectedMode] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [activeTab, setActiveTab] = useState<"all" | "featured" | "saved">("all");
  const [sortBy, setSortBy] = useState("deadline");

  // Sync / Refresh States
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<{
    type: "success" | "info" | "error";
    text: string;
  } | null>(null);

  // Dynamic Statistics
  const [stats, setStats] = useState({
    totalActive: 0,
    totalCount: 0,
    onlineCount: 0,
    inPersonCount: 0,
    formattedPrizeSum: "$0",
    uniqueOrganizers: 0,
  });

  // Squad Drawer Target
  const [squadTarget, setSquadTarget] = useState<NormalizedHackathon | null>(null);

  // 1. Listen for Firebase Auth
  useEffect(() => {
    if (!auth) return;
    let requestGeneration = 0;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const currentRequest = ++requestGeneration;
      setCurrentUser(user);
      if (!user) setSavedIds(new Set());
      else {
        loadSavedIds(user)
          .then((ids) => {
            if (currentRequest === requestGeneration) setSavedIds(new Set(ids));
          })
          .catch((err: unknown) => console.warn("Failed to fetch user bookmarks:", err));
      }
    });
    return () => {
      requestGeneration++;
      unsubscribe();
    };
  }, []);

  // 2. Fetch User's Saved Hackathons
  const fetchSavedHackathons = useCallback(async () => {
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/hackathons/saved", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSavedIds(new Set(data.savedIds || []));
      }
    } catch (err) {
      console.warn("Failed to fetch user bookmarks:", err);
    }
  }, [currentUser]);

  // 3. Load Hackathons Catalog from Cache
  const requestHackathons = useCallback(async (signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("query", searchQuery);
    if (selectedTheme !== "all") params.set("theme", selectedTheme);
    if (selectedSource !== "all") params.set("source", selectedSource);
    if (selectedMode !== "all") params.set("mode", selectedMode);
    if (selectedStatus !== "all") params.set("status", selectedStatus);

    const res = await fetch(`/api/hackathons?${params.toString()}`, {
      cache: "no-store",
      signal,
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(
        typeof errorData?.error === "string"
          ? errorData.error
          : `Failed to load hackathons directory (HTTP ${res.status}).`
      );
    }

    const data: HackathonApiResponse = await res.json();
    if (!Array.isArray(data.hackathons) || !data.stats) {
      throw new Error("The hackathons API returned an invalid catalog response.");
    }
    return data;
  }, [searchQuery, selectedTheme, selectedSource, selectedMode, selectedStatus]);

  const applyHackathonResponse = useCallback((data: HackathonApiResponse) => {
    setHackathons(data.hackathons);
    setStats(data.stats);
    setStatsAvailable(true);
    setLoadError(null);
    setLastSyncTime(data.sync?.lastSyncCompletedAt || null);
  }, []);

  const recordLoadError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : "Failed to load hackathons directory.";
    setLoadError(message);
    console.warn("Error loading hackathons:", message);
  }, []);

  const loadHackathons = useCallback(async (): Promise<boolean> => {
    try {
      applyHackathonResponse(await requestHackathons());
      return true;
    } catch (err) {
      recordLoadError(err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [applyHackathonResponse, requestHackathons, recordLoadError]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    requestHackathons(controller.signal)
      .then((data) => {
        if (!cancelled) applyHackathonResponse(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) recordLoadError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [applyHackathonResponse, recordLoadError, requestHackathons]);

  // 4. Trigger Global Synchronization Refresh
  const handleRefresh = async () => {
    if (isRefreshing) return;
    if (!currentUser) {
      setRefreshMessage({
        type: "info",
        text: "Sign in to request a global refresh.",
      });
      return;
    }

    setIsRefreshing(true);
    setRefreshMessage(null);

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/hackathons/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (res.status === 409) {
        setRefreshMessage({
          type: "info",
          text: data.message || "Global sync is already in progress. Please wait.",
        });
      } else if (data.status === "cooldown") {
        setRefreshMessage({
          type: "info",
          text: data.message || "Catalog is already up to date.",
        });
      } else if (data.success) {
        setRefreshMessage({
          type: "success",
          text: data.message || "Successfully synchronized external hackathons!",
        });
        const catalogLoaded = await loadHackathons();
        if (!catalogLoaded) {
          setRefreshMessage({
            type: "error",
            text: "Synchronization completed, but the cached directory could not be reloaded.",
          });
        }
      } else {
        setRefreshMessage({
          type: "error",
          text: data.message || "Failed to complete global synchronization.",
        });
      }
    } catch (err: unknown) {
      setRefreshMessage({
        type: "error",
        text: `Network error: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsRefreshing(false);
      // Auto-clear message after 8 seconds
      setTimeout(() => setRefreshMessage(null), 8000);
    }
  };

  // 5. Bookmark Toggle
  const handleToggleSave = async (hackathonId: string) => {
    if (!currentUser) {
      alert("Please sign in to save hackathons to your PulsePoint account.");
      return;
    }

    const isCurrentlySaved = savedIds.has(hackathonId);

    // Optimistic UI update
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (isCurrentlySaved) next.delete(hackathonId);
      else next.add(hackathonId);
      return next;
    });

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/hackathons/saved", {
        method: isCurrentlySaved ? "DELETE" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ hackathonId }),
      });

      if (!res.ok) {
        throw new Error("Failed to update bookmark in Supabase");
      }
      await fetchSavedHackathons();
    } catch (err) {
      // Revert optimistic update
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (isCurrentlySaved) next.add(hackathonId);
        else next.delete(hackathonId);
        return next;
      });
      throw err;
    }
  };

  // 6. Filter & Sort In-Memory for Tab view
  const displayedHackathons = useMemo(() => {
    let list = [...hackathons];

    if (activeTab === "featured") {
      list = list.filter((h) => h.featured);
    } else if (activeTab === "saved") {
      list = list.filter((h) => savedIds.has(h.id));
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === "prize") {
        return (b.prize_usd || 0) - (a.prize_usd || 0);
      }
      if (sortBy === "latest") {
        const addedAtA = a.discovered_at ? new Date(a.discovered_at).getTime() : 0;
        const addedAtB = b.discovered_at ? new Date(b.discovered_at).getTime() : 0;
        return addedAtB - addedAtA;
      }
      // default: deadline
      const dateA = a.registration_deadline ? new Date(a.registration_deadline).getTime() : Infinity;
      const dateB = b.registration_deadline ? new Date(b.registration_deadline).getTime() : Infinity;
      return dateA - dateB;
    });

    return list;
  }, [hackathons, activeTab, savedIds, sortBy]);

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {/* Top Navigation Header */}
      <nav className="border-b border-white/10 bg-[#070709]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" aria-label="PulsePoint Home">
              <PulsePointWordmark markClassName="w-8 h-8" className="text-xl" />
            </Link>

            <div className="hidden md:flex items-center gap-1 text-xs font-semibold">
              <Link
                href="/hackathons"
                className="px-3 py-1.5 rounded-xl bg-white/10 text-white transition-colors"
              >
                Hackathons Radar
              </Link>
              <Link
                href="/teams"
                className="px-3 py-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Teams
              </Link>
              <Link
                href="/profile"
                className="px-3 py-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Student Profile
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {currentUser ? (
              <Link
                href="/profile"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-neutral-200 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="truncate max-w-[120px]">
                  {currentUser.displayName || currentUser.email || "Profile"}
                </span>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/sign-in"
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-neutral-300 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all shadow-md shadow-rose-950/40"
                >
                  Join PulsePoint
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <HackathonHero
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedTheme={selectedTheme}
        onThemeSelect={setSelectedTheme}
        stats={stats}
        statsAvailable={statsAvailable}
        aggregatorActive={aggregatorActive}
        lastSyncTime={lastSyncTime}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        refreshMessage={refreshMessage}
      />

      {/* Filters & Tabs Navigation */}
      <HackathonFilters
        activeTab={activeTab}
        onTabChange={setActiveTab}
        savedCount={savedIds.size}
        totalCount={statsAvailable ? hackathons.length : null}
        selectedSource={selectedSource}
        onSourceChange={setSelectedSource}
        selectedMode={selectedMode}
        onModeChange={setSelectedMode}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* Main Hackathons Grid Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        {loading ? (
          /* Loading Skeletons */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-96 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse flex flex-col justify-between p-5"
              >
                <div className="h-40 rounded-xl bg-white/5 w-full mb-4" />
                <div className="space-y-2">
                  <div className="h-3 bg-white/10 rounded w-1/3" />
                  <div className="h-5 bg-white/10 rounded w-4/5" />
                  <div className="h-3 bg-white/5 rounded w-full" />
                </div>
                <div className="h-10 bg-white/5 rounded-xl mt-4" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div
            role="alert"
            className="py-20 text-center max-w-md mx-auto p-8 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-md"
          >
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4 text-rose-400">
              <SparklesIcon className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold font-serif text-white mb-2">
              Hackathons are temporarily unavailable
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed mb-6">{loadError}</p>
            <button
              onClick={() => void loadHackathons()}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all shadow-md"
            >
              Try Again
            </button>
          </div>
        ) : displayedHackathons.length === 0 ? (
          /* Empty State */
          <div className="py-20 text-center max-w-md mx-auto p-8 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-md">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4 text-rose-400">
              {activeTab === "saved" ? (
                <BookmarkIcon className="w-6 h-6" />
              ) : (
                <SparklesIcon className="w-6 h-6" />
              )}
            </div>

            <h3 className="text-xl font-bold font-serif text-white mb-2">
              {activeTab === "saved"
                ? "No Saved Hackathons Yet"
                : "No Matching Hackathons Found"}
            </h3>

            <p className="text-xs text-neutral-400 leading-relaxed mb-6">
              {activeTab === "saved"
                ? "Click the bookmark icon on any event card to save it for quick reference and squad building."
                : "Try adjusting your search query, format, or platform filters to find open opportunities."}
            </p>

            <div className="flex items-center justify-center gap-3">
              {(searchQuery ||
                selectedTheme !== "all" ||
                selectedSource !== "all" ||
                selectedMode !== "all" ||
                selectedStatus !== "all" ||
                activeTab !== "all") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedTheme("all");
                    setSelectedSource("all");
                    setSelectedMode("all");
                    setSelectedStatus("all");
                    setActiveTab("all");
                  }}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
                >
                  Reset All Filters
                </button>
              )}

              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all shadow-md"
              >
                {isRefreshing ? "Syncing..." : "Refresh Aggregator"}
              </button>
            </div>
          </div>
        ) : (
          /* Hackathons Card Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedHackathons.map((hackathon) => (
              <HackathonCard
                key={hackathon.id}
                hackathon={hackathon}
                isSaved={savedIds.has(hackathon.id)}
                onToggleSave={handleToggleSave}
                onFindSquad={(target) => setSquadTarget(target)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Squad Discovery Drawer */}
      <HackathonSquadDrawer
        hackathon={squadTarget}
        onClose={() => setSquadTarget(null)}
      />

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 bg-[#070709] text-center text-xs text-neutral-500">
        <p className="max-w-2xl mx-auto px-4 leading-relaxed mb-2">
          PulsePoint aggregates hackathon metadata in real time from public discovery feeds and official APIs. Official applications are processed directly by original platform hosts.
        </p>
        <p>© 2026 PulsePoint • Multi-Source Hackathon Radar for Collegiate Builders</p>
      </footer>
    </div>
  );
}
