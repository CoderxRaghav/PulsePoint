"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  PulsePointWordmark,
  ShieldIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ExternalLinkIcon,
} from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface QueueSuggestion {
  id: string;
  submitted_by: string;
  title: string;
  organizer: string | null;
  source_url: string;
  apply_url: string;
  mode: string | null;
  location: string | null;
  registration_deadline: string | null;
  start_date: string | null;
  end_date: string | null;
  prize_pool: string | null;
  description: string | null;
  eligibility: string | null;
  themes: string[];
  status: "pending" | "approved" | "rejected" | "published";
  review_notes: string | null;
  created_at: string;
}

interface CatalogRow {
  id: string;
  slug: string;
  title: string;
  organizer: string | null;
  source_platform: string;
  mode: string | null;
  verified: boolean;
  featured: boolean;
  archived_at: string | null;
  registration_deadline: string | null;
  verified_at: string | null;
  submitted_by: string | null;
}

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl bg-charcoal-900 border border-charcoal-700 text-warm-white placeholder:text-warm-white-muted text-sm focus:outline-none focus:border-crimson";
const labelClass = "block text-xs font-semibold text-warm-white-muted mb-1.5";
const smallBtn =
  "px-3 py-1.5 rounded-lg border border-charcoal-700 bg-charcoal-800 hover:bg-charcoal-700 text-xs font-semibold text-warm-white transition-colors";
const primaryBtn =
  "px-4 py-2 rounded-xl bg-crimson hover:bg-crimson-hover text-white text-xs font-bold transition-colors disabled:opacity-60";

export default function HackathonManagePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(() => !auth);
  const [isCurator, setIsCurator] = useState(false);
  const [configured, setConfigured] = useState(true);

  const [tab, setTab] = useState<"queue" | "catalog">("queue");

  const [suggestions, setSuggestions] = useState<QueueSuggestion[]>([]);
  const [queueTotal, setQueueTotal] = useState(0);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmDuplicateFor, setConfirmDuplicateFor] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [publishedLink, setPublishedLink] = useState<Record<string, string>>({});

  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogQueryInput, setCatalogQueryInput] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogScope, setCatalogScope] = useState<"all" | "live" | "unverified" | "archived">("all");
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [archiveResult, setArchiveResult] = useState<string | null>(null);

  const [showNewForm, setShowNewForm] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);
  const [newNotice, setNewNotice] = useState<string | null>(null);
  const [newConfirmDuplicate, setNewConfirmDuplicate] = useState(false);
  const [newForm, setNewForm] = useState({
    title: "", organizer: "", source_url: "", apply_url: "", mode: "", location: "",
    registration_deadline: "", start_date: "", end_date: "", prize_pool: "",
    description: "", eligibility: "", themes: "", skills: "",
    team_size_min: "", team_size_max: "", prize_usd: "", curation_notes: "", featured: false,
  });
  const [newSubmitting, setNewSubmitting] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const [reloadKey, setReloadKey] = useState(0);

  // Debounce the catalog search box
  useEffect(() => {
    const timer = setTimeout(() => setCatalogQuery(catalogQueryInput), 300);
    return () => clearTimeout(timer);
  }, [catalogQueryInput]);

  useEffect(() => {
    if (!isCurator || !currentUser) return;
    let cancelled = false;

    const run = async () => {
      try {
        const token = await currentUser.getIdToken();
        if (tab === "queue") {
          setQueueLoading(true);
          setQueueError(null);
          const res = await fetch("/api/admin/hackathons/suggestions?status=open&pageSize=50", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) throw new Error(data?.error || `Could not load the queue (HTTP ${res.status}).`);
          if (!cancelled) {
            setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
            setQueueTotal(typeof data?.total === "number" ? data.total : 0);
          }
        } else {
          setCatalogLoading(true);
          setCatalogError(null);
          const params = new URLSearchParams({ scope: catalogScope, pageSize: "50" });
          if (catalogQuery.trim()) params.set("query", catalogQuery.trim());
          const res = await fetch(`/api/admin/hackathons?${params.toString()}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) throw new Error(data?.error || `Could not load the catalog (HTTP ${res.status}).`);
          if (!cancelled) {
            setCatalog(Array.isArray(data?.hackathons) ? data.hackathons : []);
            setCatalogTotal(typeof data?.total === "number" ? data.total : 0);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not load data.";
        if (!cancelled) {
          if (tab === "queue") setQueueError(message);
          else setCatalogError(message);
        }
      } finally {
        if (!cancelled) {
          setQueueLoading(false);
          setCatalogLoading(false);
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [isCurator, currentUser, tab, catalogScope, catalogQuery, reloadKey]);

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
          setConfigured(data.configured !== false);
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

  const tokenFor = async () => {
    if (!currentUser) return null;
    return currentUser.getIdToken();
  };

  const moderate = async (id: string, action: "approve" | "reject" | "publish", extra: Record<string, unknown> = {}) => {
    const token = await tokenFor();
    if (!token || actionId) return;
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/hackathons/suggestions/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, review_notes: reviewNotes[id] || null, ...extra }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 409 && action === "publish" && !extra.confirm_duplicate) {
        setConfirmDuplicateFor(id);
        return;
      }
      if (!res.ok) {
        setQueueError(data?.error || `Action failed (HTTP ${res.status}).`);
        return;
      }
      if (action === "publish" && data?.hackathonId) {
        setPublishedLink((prev) => ({ ...prev, [id]: data.hackathonId }));
      }
      setConfirmDuplicateFor(null);
      setReloadKey((key) => key + 1);
    } catch {
      setQueueError("Network error during the moderation action.");
    } finally {
      setActionId(null);
    }
  };

  const catalogAction = async (id: string, action: "verify" | "archive" | "unarchive" | "feature" | "unfeature") => {
    const token = await tokenFor();
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/hackathons/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setCatalogError(data?.error || `Could not ${action} the listing.`);
        return;
      }
      setReloadKey((key) => key + 1);
    } catch {
      setCatalogError("Network error while updating the listing.");
    }
  };

  const archiveExpired = async () => {
    const token = await tokenFor();
    if (!token) return;
    try {
      const res = await fetch("/api/admin/hackathons/archive-expired", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      setArchiveResult(res.ok ? `Archived ${data?.archived ?? 0} expired event(s).` : (data?.error || "Could not archive expired events."));
      if (res.ok) setReloadKey((key) => key + 1);
    } catch {
      setArchiveResult("Network error while archiving expired events.");
    }
  };

  const submitNewListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newSubmitting) return;
    const token = await tokenFor();
    if (!token) return;
    setNewSubmitting(true);
    setNewError(null);
    setNewNotice(null);

    try {
      const res = await fetch("/api/admin/hackathons", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newForm.title.trim(),
          organizer: newForm.organizer.trim() || null,
          source_url: newForm.source_url.trim(),
          apply_url: newForm.apply_url.trim(),
          mode: newForm.mode || null,
          location: newForm.location.trim() || null,
          registration_deadline: newForm.registration_deadline ? new Date(newForm.registration_deadline).toISOString() : null,
          start_date: newForm.start_date ? new Date(newForm.start_date).toISOString() : null,
          end_date: newForm.end_date ? new Date(newForm.end_date).toISOString() : null,
          prize_pool: newForm.prize_pool.trim() || null,
          prize_usd: newForm.prize_usd ? Number(newForm.prize_usd) : null,
          description: newForm.description.trim() || null,
          eligibility: newForm.eligibility.trim() || null,
          themes: newForm.themes.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12),
          skills: newForm.skills.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20),
          team_size_min: newForm.team_size_min ? Number(newForm.team_size_min) : null,
          team_size_max: newForm.team_size_max ? Number(newForm.team_size_max) : null,
          curation_notes: newForm.curation_notes.trim() || null,
          featured: newForm.featured,
          confirm_duplicate: newConfirmDuplicate,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 409 && data?.matches) {
        setNewError(`${data.error} Matches: ${(data.matches as Array<{ title: string }>).map((m) => m.title).join("; ")}`);
        setNewConfirmDuplicate(true);
        return;
      }
      if (!res.ok) {
        const details = Array.isArray(data?.details) ? ` ${data.details.join(" ")}` : "";
        throw new Error((data?.error || "Could not create the listing.") + details);
      }
      setNewNotice(`Published "${newForm.title.trim()}".`);
      setNewForm({
        title: "", organizer: "", source_url: "", apply_url: "", mode: "", location: "",
        registration_deadline: "", start_date: "", end_date: "", prize_pool: "",
        description: "", eligibility: "", themes: "", skills: "",
        team_size_min: "", team_size_max: "", prize_usd: "", curation_notes: "", featured: false,
      });
      setNewConfirmDuplicate(false);
      setShowNewForm(false);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setNewError(err instanceof Error ? err.message : "Could not create the listing.");
    } finally {
      setNewSubmitting(false);
    }
  };

  // ---------- gates ----------
  if (!authReady) {
    return <div className="min-h-screen bg-space-black text-warm-white-muted flex items-center justify-center text-sm">Checking your sign-in…</div>;
  }
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-space-black text-warm-white flex flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold font-serif">Curator sign-in required</h1>
        <p className="text-xs text-warm-white-muted max-w-sm">The curation console is limited to PulsePoint curators.</p>
        <Link href="/sign-in" className="px-5 py-2.5 rounded-xl bg-crimson hover:bg-crimson-hover text-white text-xs font-semibold">Sign in</Link>
      </div>
    );
  }
  if (!isCurator) {
    return (
      <div className="min-h-screen bg-space-black text-warm-white flex flex-col items-center justify-center gap-4 px-4 text-center">
        <ShieldIcon className="w-10 h-10 text-warm-white-muted" />
        <h1 className="text-2xl font-bold font-serif">Not a curator</h1>
        <p className="text-xs text-warm-white-muted max-w-sm">
          {configured
            ? "Your account does not have curator access. Ask the PulsePoint team to add your Firebase UID to HACKATHON_CURATOR_UIDS."
            : "Hackathon curation is not configured on this deployment yet (HACKATHON_CURATOR_UIDS is empty)."}
        </p>
        <Link href="/hackathons" className="px-5 py-2.5 rounded-xl border border-charcoal-700 bg-charcoal-800 hover:bg-charcoal-700 text-warm-white text-xs font-semibold">Back to catalog</Link>
      </div>
    );
  }

  // ---------- console ----------
  return (
    <div className="min-h-screen bg-space-black text-warm-white flex flex-col">
      <nav className="border-b border-charcoal-700 bg-space-black/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/hackathons" aria-label="Back to catalog">
            <PulsePointWordmark markClassName="w-7 h-7" className="text-lg" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
              <ShieldIcon className="w-3.5 h-3.5" /> Curator
            </span>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 flex-1">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold font-serif tracking-tight">Curation console</h1>
            <p className="text-xs text-warm-white-muted mt-1">Review student suggestions, publish verified listings, archive expired ones.</p>
          </div>
          <button onClick={() => setShowNewForm((v) => !v)} className={primaryBtn}>
            {showNewForm ? "Close form" : "New curated listing"}
          </button>
        </div>

        {/* New listing form */}
        {showNewForm && (
          <form onSubmit={submitNewListing} className="mb-6 rounded-2xl border border-charcoal-700 bg-charcoal-900 p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold font-serif">New curated listing</h2>
              {newNotice && <p role="status" className="text-xs text-emerald-700 dark:text-emerald-400">{newNotice}</p>}
            </div>
            {newError && (
              <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-600/30 bg-rose-600/10 px-4 py-3 text-xs text-rose-800 dark:text-rose-300">
                <AlertCircleIcon className="w-4 h-4 mt-0.5 shrink-0" /><span>{newError}</span>
              </p>
            )}
            {newConfirmDuplicate && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300">A similar listing exists. Submit again to confirm publishing a distinct event.</p>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="n-title" className={labelClass}>Title *</label>
                <input id="n-title" required value={newForm.title} onChange={(e) => setNewForm({ ...newForm, title: e.target.value })} className={inputClass} maxLength={160} />
              </div>
              <div>
                <label htmlFor="n-org" className={labelClass}>Organizer</label>
                <input id="n-org" value={newForm.organizer} onChange={(e) => setNewForm({ ...newForm, organizer: e.target.value })} className={inputClass} maxLength={160} />
              </div>
              <div>
                <label htmlFor="n-mode" className={labelClass}>Format</label>
                <select id="n-mode" value={newForm.mode} onChange={(e) => setNewForm({ ...newForm, mode: e.target.value })} className={inputClass}>
                  <option value="">Not listed</option>
                  <option value="Online">Online</option>
                  <option value="In Person">In Person</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="n-source" className={labelClass}>Official listing page *</label>
                <input id="n-source" required type="url" value={newForm.source_url} onChange={(e) => setNewForm({ ...newForm, source_url: e.target.value })} className={inputClass} placeholder="https://…" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="n-apply" className={labelClass}>Official registration link *</label>
                <input id="n-apply" required type="url" value={newForm.apply_url} onChange={(e) => setNewForm({ ...newForm, apply_url: e.target.value })} className={inputClass} placeholder="https://…" />
              </div>
              <div>
                <label htmlFor="n-loc" className={labelClass}>Location</label>
                <input id="n-loc" value={newForm.location} onChange={(e) => setNewForm({ ...newForm, location: e.target.value })} className={inputClass} maxLength={160} />
              </div>
              <div>
                <label htmlFor="n-prize" className={labelClass}>Prize pool (display text)</label>
                <input id="n-prize" value={newForm.prize_pool} onChange={(e) => setNewForm({ ...newForm, prize_pool: e.target.value })} className={inputClass} maxLength={200} placeholder="As written on the official page" />
              </div>
              <div>
                <label htmlFor="n-prizeusd" className={labelClass}>Prize (USD, for stats)</label>
                <input id="n-prizeusd" type="number" min="0" value={newForm.prize_usd} onChange={(e) => setNewForm({ ...newForm, prize_usd: e.target.value })} className={inputClass} placeholder="Leave empty if unknown" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="n-tmin" className={labelClass}>Team min</label>
                  <input id="n-tmin" type="number" min="1" max="50" value={newForm.team_size_min} onChange={(e) => setNewForm({ ...newForm, team_size_min: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="n-tmax" className={labelClass}>Team max</label>
                  <input id="n-tmax" type="number" min="1" max="50" value={newForm.team_size_max} onChange={(e) => setNewForm({ ...newForm, team_size_max: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div>
                <label htmlFor="n-deadline" className={labelClass}>Registration deadline</label>
                <input id="n-deadline" type="datetime-local" value={newForm.registration_deadline} onChange={(e) => setNewForm({ ...newForm, registration_deadline: e.target.value })} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="n-start" className={labelClass}>Start</label>
                  <input id="n-start" type="datetime-local" value={newForm.start_date} onChange={(e) => setNewForm({ ...newForm, start_date: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="n-end" className={labelClass}>End</label>
                  <input id="n-end" type="datetime-local" value={newForm.end_date} onChange={(e) => setNewForm({ ...newForm, end_date: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div>
                <label htmlFor="n-themes" className={labelClass}>Themes</label>
                <input id="n-themes" value={newForm.themes} onChange={(e) => setNewForm({ ...newForm, themes: e.target.value })} className={inputClass} placeholder="AI/ML, Web Development" />
              </div>
              <div>
                <label htmlFor="n-skills" className={labelClass}>Skills</label>
                <input id="n-skills" value={newForm.skills} onChange={(e) => setNewForm({ ...newForm, skills: e.target.value })} className={inputClass} placeholder="React, Python" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="n-desc" className={labelClass}>Description</label>
                <textarea id="n-desc" value={newForm.description} onChange={(e) => setNewForm({ ...newForm, description: e.target.value })} className={`${inputClass} min-h-24`} maxLength={8000} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="n-elig" className={labelClass}>Eligibility</label>
                <input id="n-elig" value={newForm.eligibility} onChange={(e) => setNewForm({ ...newForm, eligibility: e.target.value })} className={inputClass} maxLength={2000} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="n-notes" className={labelClass}>Internal curation notes (never shown publicly)</label>
                <input id="n-notes" value={newForm.curation_notes} onChange={(e) => setNewForm({ ...newForm, curation_notes: e.target.value })} className={inputClass} maxLength={2000} placeholder="How did you verify this listing?" />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-warm-white-muted">
                <input type="checkbox" checked={newForm.featured} onChange={(e) => setNewForm({ ...newForm, featured: e.target.checked })} />
                Feature on the catalog
              </label>
              <button type="submit" disabled={newSubmitting} className={primaryBtn}>
                {newSubmitting ? "Publishing…" : newConfirmDuplicate ? "Publish anyway" : "Publish listing"}
              </button>
            </div>
          </form>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setTab("queue")}
            aria-pressed={tab === "queue"}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${tab === "queue" ? "bg-crimson text-white" : "border border-charcoal-700 bg-charcoal-900 text-warm-white-muted hover:text-warm-white"}`}
          >
            Suggestion queue ({queueTotal})
          </button>
          <button
            onClick={() => setTab("catalog")}
            aria-pressed={tab === "catalog"}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${tab === "catalog" ? "bg-crimson text-white" : "border border-charcoal-700 bg-charcoal-900 text-warm-white-muted hover:text-warm-white"}`}
          >
            Catalog ({catalogTotal})
          </button>
        </div>

        {/* ---------- QUEUE TAB ---------- */}
        {tab === "queue" && (
          <div className="space-y-4">
            {queueError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{queueError}</p>}
            {queueLoading ? (
              <p role="status" className="text-sm text-warm-white-muted py-12 text-center">Loading the queue…</p>
            ) : suggestions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-charcoal-700 px-6 py-14 text-center">
                <CheckCircleIcon className="w-8 h-8 mx-auto mb-3 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-lg font-bold font-serif">Queue is clear</h2>
                <p className="text-xs text-warm-white-muted mt-1">Student suggestions will appear here for review.</p>
              </div>
            ) : (
              suggestions.map((s) => (
                <article key={s.id} className="rounded-2xl border border-charcoal-700 bg-charcoal-900 p-5 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${s.status === "approved" ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300" : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
                          {s.status}
                        </span>
                        <span className="text-[11px] text-warm-white-muted">{new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                      <h3 className="text-base font-bold font-serif mt-1.5 leading-snug">{s.title}</h3>
                      <p className="text-[11px] text-warm-white-muted mt-0.5">
                        {s.organizer || "Organizer not listed"}{s.mode ? ` · ${s.mode}` : ""}{s.location ? ` · ${s.location}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-[11px]">
                      <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-crimson hover:underline">Listing <ExternalLinkIcon className="w-3 h-3" /></a>
                      <a href={s.apply_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-crimson hover:underline">Registration <ExternalLinkIcon className="w-3 h-3" /></a>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-warm-white-muted">
                    <span>Deadline: <span className="text-warm-white">{s.registration_deadline ? new Date(s.registration_deadline).toLocaleDateString() : "not listed"}</span></span>
                    <span>Start: <span className="text-warm-white">{s.start_date ? new Date(s.start_date).toLocaleDateString() : "not listed"}</span></span>
                    <span>Prize: <span className="text-warm-white">{s.prize_pool || "not listed"}</span></span>
                    <span>Themes: <span className="text-warm-white">{s.themes.length ? s.themes.join(", ") : "—"}</span></span>
                  </div>
                  {s.description && <p className="text-xs text-warm-white-muted leading-relaxed line-clamp-3">{s.description}</p>}
                  {s.eligibility && <p className="text-[11px] text-warm-white-muted">Eligibility: {s.eligibility}</p>}
                  <p className="text-[10px] text-warm-white-muted/70 font-mono">Submitted by UID {s.submitted_by}</p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      value={reviewNotes[s.id] ?? ""}
                      onChange={(e) => setReviewNotes({ ...reviewNotes, [s.id]: e.target.value })}
                      placeholder="Review notes (optional, shown to the student on rejection)"
                      aria-label="Review notes"
                      className="flex-1 min-w-48 px-3 py-2 rounded-xl bg-charcoal-800 border border-charcoal-700 text-xs text-warm-white placeholder:text-warm-white-muted focus:outline-none focus:border-crimson"
                    />
                    {(s.status === "pending") && (
                      <button className={smallBtn} disabled={actionId === s.id} onClick={() => moderate(s.id, "approve")}>
                        Approve
                      </button>
                    )}
                    <button className={smallBtn} disabled={actionId === s.id} onClick={() => moderate(s.id, "reject")}>
                      Reject
                    </button>
                    <button className={primaryBtn} disabled={actionId === s.id} onClick={() => moderate(s.id, "publish", confirmDuplicateFor === s.id ? { confirm_duplicate: true } : {})}>
                      {actionId === s.id ? "Working…" : confirmDuplicateFor === s.id ? "Publish anyway" : "Approve & publish"}
                    </button>
                  </div>
                  {publishedLink[s.id] && (
                    <p className="text-xs">
                      Published: <Link href={`/hackathons/${publishedLink[s.id]}`} className="text-crimson hover:underline">/hackathons/{publishedLink[s.id]}</Link>
                    </p>
                  )}
                </article>
              ))
            )}
          </div>
        )}

        {/* ---------- CATALOG TAB ---------- */}
        {tab === "catalog" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={catalogQueryInput}
                onChange={(e) => setCatalogQueryInput(e.target.value)}
                placeholder="Search title or organizer…"
                aria-label="Search catalog"
                className="flex-1 min-w-48 px-3.5 py-2 rounded-xl bg-charcoal-900 border border-charcoal-700 text-sm text-warm-white placeholder:text-warm-white-muted focus:outline-none focus:border-crimson"
              />
              <select value={catalogScope} onChange={(e) => setCatalogScope(e.target.value as typeof catalogScope)} aria-label="Catalog scope" className={inputClass + " w-auto"}>
                <option value="all">All rows</option>
                <option value="live">Live (verified)</option>
                <option value="unverified">Unverified</option>
                <option value="archived">Archived</option>
              </select>
              <button className={smallBtn} onClick={archiveExpired}>Archive expired now</button>
              <button className={smallBtn} onClick={() => setReloadKey((key) => key + 1)}>Refresh</button>
            </div>
            {archiveResult && <p role="status" className="text-xs text-warm-white-muted">{archiveResult}</p>}
            {catalogError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{catalogError}</p>}
            {catalogLoading ? (
              <p role="status" className="text-sm text-warm-white-muted py-12 text-center">Loading catalog…</p>
            ) : catalog.length === 0 ? (
              <p className="text-xs text-warm-white-muted py-12 text-center">No rows match this scope.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-charcoal-700">
                <table className="w-full text-xs">
                  <thead className="bg-charcoal-800 text-warm-white-muted">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold">Title</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Source</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Deadline</th>
                      <th className="text-left px-4 py-2.5 font-semibold">State</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-charcoal-700">
                    {catalog.map((row) => (
                      <tr key={row.id} className="bg-charcoal-900">
                        <td className="px-4 py-2.5">
                          <Link href={`/hackathons/${row.id}`} className="font-semibold text-warm-white hover:text-crimson">{row.title}</Link>
                          <p className="text-[10px] text-warm-white-muted">{row.organizer || "Organizer not listed"}</p>
                        </td>
                        <td className="px-4 py-2.5 text-warm-white-muted">{row.source_platform}</td>
                        <td className="px-4 py-2.5 text-warm-white-muted">{row.registration_deadline ? new Date(row.registration_deadline).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className="flex flex-wrap gap-1">
                            {row.verified ? <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 text-[10px]">verified</span> : <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 text-[10px]">unverified</span>}
                            {row.featured && <span className="px-1.5 py-0.5 rounded bg-crimson/10 text-crimson border border-crimson/25 text-[10px]">featured</span>}
                            {row.archived_at && <span className="px-1.5 py-0.5 rounded bg-neutral-500/10 text-warm-white-muted border border-charcoal-700 text-[10px]">archived</span>}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {!row.verified && <button className={smallBtn} onClick={() => catalogAction(row.id, "verify")}>Verify</button>}
                            <button className={smallBtn} onClick={() => catalogAction(row.id, row.featured ? "unfeature" : "feature")}>{row.featured ? "Unfeature" : "Feature"}</button>
                            {row.archived_at
                              ? <button className={smallBtn} onClick={() => catalogAction(row.id, "unarchive")}>Restore</button>
                              : <button className={smallBtn} onClick={() => catalogAction(row.id, "archive")}>Archive</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
