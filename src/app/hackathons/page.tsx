"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import {
  PulsePointWordmark,
  SparklesIcon,
  BookmarkIcon,
} from "@/components/ui/icons";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { AggregatorSyncSummary, NormalizedHackathon } from "@/lib/aggregator/types";
import { HackathonHero } from "@/components/hackathons/hackathon-hero";
import { HackathonFilters, type DeadlineFilter } from "@/components/hackathons/hackathon-filters";
import { HackathonCard } from "@/components/hackathons/hackathon-card";
import { HackathonSquadDrawer } from "@/components/hackathons/hackathon-squad-drawer";

interface HackathonApiResponse {
  hackathons: Array<NormalizedHackathon & { phase?: string }>;
  total: number;
  page: number;
  pageSize: number;
  includeClosed: boolean;
  stats: {
    totalActive: number;
    totalCount: number;
    onlineCount: number;
    inPersonCount: number;
    formattedPrizeSum: string;
    totalPrizeUsd: number;
    uniqueOrganizers: number;
    sources: string[];
    totalLive: number;
    totalClosed: number;
    totalAll: number;
  };
  sync: {
    status: string;
    lastSyncCompletedAt: string | null;
    totalDiscovered: number;
  };
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function HackathonsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCurator, setIsCurator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [hackathons, setHackathons] = useState<Array<NormalizedHackathon & { phase?: string }>>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [bookmarkNotice, setBookmarkNotice] = useState<string | null>(null);

  // Filters — search input is immediate, the catalog query is debounced
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const [selectedTheme, setSelectedTheme] = useState("all");
  const [selectedSource, setSelectedSource] = useState("all");
  const [selectedMode, setSelectedMode] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>("live");
  const [activeTab, setActiveTab] = useState<"all" | "featured" | "saved">("all");
  const [sortBy, setSortBy] = useState("deadline");

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<{
    type: "success" | "info" | "error";
    text: string;
  } | null>(null);
  const refreshInFlight = useRef(false);

  const [stats, setStats] = useState({
    totalActive: 0,
    totalCount: 0,
    onlineCount: 0,
    inPersonCount: 0,
    formattedPrizeSum: "$0",
    uniqueOrganizers: 0,
  });

  const [squadTarget, setSquadTarget] = useState<NormalizedHackathon | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Firebase Auth listener
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Curator probe (UI gating only — the server enforces authorization)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!currentUser) {
        setIsCurator(false);
        return;
      }
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch("/api/admin/me", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setIsCurator(Boolean(data.isCurator));
        } else if (!cancelled) {
          setIsCurator(false);
        }
      } catch {
        if (!cancelled) setIsCurator(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [currentUser]);

  // Load the signed-in user's bookmarks
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!currentUser) {
        if (!cancelled) setSavedIds(new Set());
        return;
      }
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch("/api/hackathons/saved", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setSavedIds(new Set(data.savedIds || []));
        }
      } catch (err) {
        console.warn("Failed to fetch user bookmarks:", err);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [currentUser]);

  const buildParams = useCallback((pageNumber: number) => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("query", debouncedQuery);
    if (selectedTheme !== "all") params.set("theme", selectedTheme);
    if (selectedSource !== "all") params.set("source", selectedSource);
    if (selectedMode !== "all") params.set("mode", selectedMode);
    if (selectedStatus !== "all") params.set("status", selectedStatus);
    if (deadlineFilter === "7d" || deadlineFilter === "30d") {
      const windowDays = deadlineFilter === "7d" ? 7 : 30;
      params.set("deadline_before", new Date(Date.now() + windowDays * 24 * 3600 * 1000).toISOString());
    } else if (deadlineFilter === "all") {
      params.set("include_closed", "true");
    }
    if (sortBy) params.set("sort", sortBy);
    params.set("page", String(pageNumber));
    return params;
  }, [debouncedQuery, selectedTheme, selectedSource, selectedMode, selectedStatus, deadlineFilter, sortBy]);

  // Fetch catalog page 1 whenever filters change
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const run = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/hackathons?${buildParams(1).toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          throw new Error(
            typeof errorData?.error === "string"
              ? errorData.error
              : `Failed to load hackathons (HTTP ${res.status}).`
          );
        }

        const data: HackathonApiResponse = await res.json();
        if (!Array.isArray(data.hackathons) || !data.stats) {
          throw new Error("The hackathons API returned an invalid response.");
        }
        if (!cancelled) {
          setLoadError(null);
          setCatalogLoaded(true);
          setHackathons(data.hackathons);
          setPage(1);
          setTotal(data.total);
          setStats(data.stats);
          setLastSyncTime(data.sync?.lastSyncCompletedAt || null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message = controller.signal.aborted
            ? "Loading the hackathon directory timed out. Please try again."
            : err instanceof Error
              ? err.message
              : "Failed to load hackathons.";
          setLoadError(message);
        }
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [buildParams, refreshCounter]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await fetch(`/api/hackathons?${buildParams(nextPage).toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load more (HTTP ${res.status}).`);
      const data: HackathonApiResponse = await res.json();
      setHackathons((current) => [...current, ...(data.hackathons || [])]);
      setPage(nextPage);
      setTotal(data.total);
    } catch (err) {
      console.warn("Load more failed:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Curator-only catalog refresh (automated sources stay disabled without authorization)
  const handleRefresh = async () => {
    if (refreshInFlight.current) return;
    if (!currentUser) {
      setRefreshMessage({ type: "info", text: "Sign in with a curator account to refresh the catalog." });
      return;
    }

    refreshInFlight.current = true;
    setIsRefreshing(true);
    setRefreshMessage(null);
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

    try {
      const token = await currentUser.getIdToken();
      const controller = new AbortController();
      refreshTimeout = setTimeout(() => controller.abort(), 60_000);
      const res = await fetch("/api/hackathons/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      const data = (await res.json()) as {
        success?: boolean;
        status?: string;
        message?: string;
        error?: string;
        summary?: AggregatorSyncSummary;
      };
      const text = data.message || data.error || "Catalog refresh finished.";

      if (res.status === 403) {
        setRefreshMessage({ type: "info", text: "Catalog refresh is limited to PulsePoint curators." });
      } else if (res.status === 409) {
        setRefreshMessage({ type: "info", text: text || "A refresh is already running." });
      } else if (res.ok && data.success) {
        setRefreshMessage({ type: "success", text });
        setRefreshCounter((c) => c + 1);
      } else {
        setRefreshMessage({ type: "error", text });
      }
    } catch (err: unknown) {
      setRefreshMessage({
        type: "error",
        text:
          err instanceof Error && err.name === "AbortError"
            ? "Refresh timed out. Please retry."
            : `Refresh failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshInFlight.current = false;
      setIsRefreshing(false);
      setTimeout(() => setRefreshMessage(null), 8000);
    }
  };

  const handleToggleSave = async (hackathonId: string) => {
    if (!currentUser) {
      setBookmarkNotice("Sign in to save hackathons to your account.");
      setTimeout(() => setBookmarkNotice(null), 4000);
      return; // not an error — the card simply keeps the saved state unchanged
    }

    const token = await currentUser.getIdToken();
    const isCurrentlySaved = savedIds.has(hackathonId);

    setSavedIds((prev) => {
      const next = new Set(prev);
      if (isCurrentlySaved) next.delete(hackathonId);
      else next.add(hackathonId);
      return next;
    });

    try {
      const res = await fetch("/api/hackathons/saved", {
        method: isCurrentlySaved ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ hackathonId }),
      });
      if (!res.ok) {
        throw new Error("Failed to update bookmark");
      }
    } catch (error: unknown) {
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (isCurrentlySaved) next.add(hackathonId);
        else next.delete(hackathonId);
        return next;
      });
      throw error;
    }
  };

  // Tabs filter the loaded pages client-side
  const displayedHackathons = useMemo(() => {
    let list = [...hackathons];
    if (activeTab === "featured") list = list.filter((h) => h.featured);
    else if (activeTab === "saved") list = list.filter((h) => savedIds.has(h.id));
    return list;
  }, [hackathons, activeTab, savedIds]);

  const hasMore = hackathons.length < total && activeTab !== "saved" && activeTab !== "featured";

  return (
    <div className="min-h-screen bg-space-black text-warm-white flex flex-col">
      {/* Nav */}
      <nav className="border-b border-charcoal-700 bg-space-black/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" aria-label="PulsePoint home">
              <PulsePointWordmark markClassName="w-8 h-8" className="text-xl" />
            </Link>

            <div className="hidden md:flex items-center gap-1 text-xs font-semibold">
              <Link href="/hackathons" aria-current="page" className="px-3 py-1.5 rounded-xl bg-crimson text-white transition-colors">
                Hackathons
              </Link>
              <Link href="/teams" className="px-3 py-1.5 rounded-xl text-warm-white-muted hover:text-warm-white hover:bg-charcoal-800 transition-colors">
                Teams
              </Link>
              <Link href="/profile" className="px-3 py-1.5 rounded-xl text-warm-white-muted hover:text-warm-white hover:bg-charcoal-800 transition-colors">
                Student Profile
              </Link>
              {isCurator && (
                <Link href="/hackathons/manage" className="px-3 py-1.5 rounded-xl text-warm-white-muted hover:text-warm-white hover:bg-charcoal-800 transition-colors">
                  Manage
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            {currentUser ? (
              <Link
                href="/profile"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-charcoal-800 hover:bg-charcoal-700 border border-charcoal-700 text-xs font-medium text-warm-white transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <span className="truncate max-w-[140px]">
                  {currentUser.displayName || currentUser.email || "Profile"}
                </span>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/sign-in" className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-warm-white-muted hover:text-warm-white transition-colors">
                  Sign In
                </Link>
                <Link href="/sign-up" className="px-3.5 py-1.5 rounded-xl bg-crimson hover:bg-crimson-hover text-white text-xs font-semibold transition-colors">
                  Join PulsePoint
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <HackathonHero
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedTheme={selectedTheme}
        onThemeSelect={setSelectedTheme}
        stats={stats}
        statsAvailable={catalogLoaded}
        isCurator={isCurator}
        lastSyncTime={lastSyncTime}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        refreshMessage={refreshMessage}
      />

      {/* Filters */}
      <HackathonFilters
        activeTab={activeTab}
        onTabChange={setActiveTab}
        savedCount={savedIds.size}
        totalCount={catalogLoaded ? total : null}
        selectedSource={selectedSource}
        onSourceChange={setSelectedSource}
        selectedMode={selectedMode}
        onModeChange={setSelectedMode}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        deadlineFilter={deadlineFilter}
        onDeadlineFilterChange={setDeadlineFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {bookmarkNotice && (
        <p role="status" className="mx-auto mt-4 max-w-7xl w-full px-4 sm:px-6 lg:px-8 text-xs text-warm-white-muted">
          {bookmarkNotice}
        </p>
      )}

      {/* Grid */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-96 rounded-2xl bg-charcoal-900 border border-charcoal-700 animate-pulse flex flex-col justify-between p-5"
              >
                <div className="h-36 rounded-xl bg-charcoal-800 w-full mb-4" />
                <div className="space-y-2">
                  <div className="h-3 bg-charcoal-800 rounded w-1/3" />
                  <div className="h-5 bg-charcoal-800 rounded w-4/5" />
                  <div className="h-3 bg-charcoal-800 rounded w-full" />
                </div>
                <div className="h-10 bg-charcoal-800 rounded-xl mt-4" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div role="alert" className="py-20 text-center max-w-md mx-auto p-8 rounded-3xl border border-charcoal-700 bg-charcoal-900">
            <h3 className="text-xl font-bold text-warm-white mb-2 font-serif">Hackathons are temporarily unavailable</h3>
            <p className="text-xs text-warm-white-muted leading-relaxed mb-6">{loadError}</p>
            <button
              onClick={() => setRefreshCounter((count) => count + 1)}
              className="px-4 py-2 rounded-xl bg-crimson hover:bg-crimson-hover text-white text-xs font-semibold transition-colors"
            >
              Try again
            </button>
          </div>
        ) : displayedHackathons.length === 0 ? (
          <div className="py-20 text-center max-w-md mx-auto p-8 rounded-3xl border border-charcoal-700 bg-charcoal-900">
            <div className="w-14 h-14 rounded-2xl bg-crimson/10 border border-crimson/20 flex items-center justify-center mx-auto mb-4 text-crimson">
              {activeTab === "saved" ? <BookmarkIcon className="w-6 h-6" /> : <SparklesIcon className="w-6 h-6" />}
            </div>
            <h3 className="text-xl font-bold text-warm-white mb-2 font-serif">
              {activeTab === "saved" ? "No saved hackathons yet" : "No hackathons match these filters"}
            </h3>
            <p className="text-xs text-warm-white-muted leading-relaxed mb-6">
              {activeTab === "saved"
                ? "Bookmark any event to keep it here — including ones that have ended."
                : "PulsePoint is a small curated catalog. Nothing matches this combination right now — clear your filters, or suggest an event and our curators will review it."}
            </p>
            <div className="flex items-center justify-center gap-3">
              {(debouncedQuery ||
                selectedTheme !== "all" ||
                selectedSource !== "all" ||
                selectedMode !== "all" ||
                selectedStatus !== "all" ||
                deadlineFilter !== "live" ||
                activeTab !== "all") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedTheme("all");
                    setSelectedSource("all");
                    setSelectedMode("all");
                    setSelectedStatus("all");
                    setDeadlineFilter("live");
                    setActiveTab("all");
                  }}
                  className="px-4 py-2 rounded-xl border border-charcoal-700 bg-charcoal-800 hover:bg-charcoal-700 text-warm-white text-xs font-semibold transition-colors"
                >
                  Reset filters
                </button>
              )}
              <Link
                href="/hackathons/suggest"
                className="px-4 py-2 rounded-xl bg-crimson hover:bg-crimson-hover text-white text-xs font-semibold transition-colors"
              >
                Suggest an event
              </Link>
            </div>
          </div>
        ) : (
          <>
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

            <div className="mt-8 flex items-center justify-center gap-4">
              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-5 py-2.5 rounded-xl border border-charcoal-700 bg-charcoal-800 hover:bg-charcoal-700 text-warm-white text-xs font-semibold transition-colors disabled:opacity-60"
                >
                  {loadingMore ? "Loading…" : `Load more (${hackathons.length} of ${total})`}
                </button>
              )}
              {deadlineFilter === "live" && selectedStatus === "all" && (
                <button
                  onClick={() => setDeadlineFilter("all")}
                  className="text-xs text-warm-white-muted hover:text-warm-white underline"
                >
                  Show closed events too
                </button>
              )}
            </div>
          </>
        )}
      </main>

      {/* Squad drawer */}
      <HackathonSquadDrawer hackathon={squadTarget} onClose={() => setSquadTarget(null)} />

      {/* Footer */}
      <footer className="border-t border-charcoal-700 py-8 bg-space-black text-center text-xs text-warm-white-muted">
        <p className="max-w-2xl mx-auto px-4 leading-relaxed mb-2">
          PulsePoint curates verified hackathon listings and links each one to its official registration page.
          Registrations, submissions and judging happen on the organizer&apos;s platform, not on PulsePoint.
        </p>
        <p>© 2026 PulsePoint · Built for collegiate builders</p>
      </footer>
    </div>
  );
}
