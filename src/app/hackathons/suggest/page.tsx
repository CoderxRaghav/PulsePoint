"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  PulsePointWordmark,
  CheckCircleIcon,
  AlertCircleIcon,
  ShieldIcon,
} from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface MySuggestion {
  id: string;
  title: string;
  organizer: string | null;
  status: "pending" | "approved" | "rejected" | "published";
  created_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
  published_hackathon_id: string | null;
}

const STATUS_PILL: Record<MySuggestion["status"], string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  approved: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  rejected: "border-rose-600/30 bg-rose-600/10 text-rose-800 dark:text-rose-300",
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
};

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl bg-charcoal-900 border border-charcoal-700 text-warm-white placeholder:text-warm-white-muted text-sm focus:outline-none focus:border-crimson";
const labelClass = "block text-xs font-semibold text-warm-white-muted mb-1.5";

export default function SuggestHackathonPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  // With Firebase unconfigured there is no auth step to wait for.
  const [authReady, setAuthReady] = useState(() => !auth);

  const [title, setTitle] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [applyUrl, setApplyUrl] = useState("");
  const [mode, setMode] = useState("");
  const [location, setLocation] = useState("");
  const [deadline, setDeadline] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [prizePool, setPrizePool] = useState("");
  const [description, setDescription] = useState("");
  const [eligibility, setEligibility] = useState("");
  const [themes, setThemes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);

  const [mySuggestions, setMySuggestions] = useState<MySuggestion[]>([]);
  const [myError, setMyError] = useState<string | null>(null);
  const [mineRefresh, setMineRefresh] = useState(0);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const run = async () => {
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch("/api/hackathons/suggestions", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (!cancelled) setMyError("Could not load your suggestions.");
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setMySuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
          setMyError(null);
        }
      } catch {
        if (!cancelled) setMyError("Could not load your suggestions.");
      }
    };
    run();
    return () => { cancelled = true; };
  }, [currentUser, mineRefresh]);

  const resetForm = () => {
    setTitle(""); setOrganizer(""); setSourceUrl(""); setApplyUrl("");
    setMode(""); setLocation(""); setDeadline(""); setStartDate(""); setEndDate("");
    setPrizePool(""); setDescription(""); setEligibility(""); setThemes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitNotice(null);

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/hackathons/suggestions", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          organizer: organizer.trim() || null,
          source_url: sourceUrl.trim(),
          apply_url: applyUrl.trim(),
          mode: mode || null,
          location: location.trim() || null,
          registration_deadline: deadline ? new Date(deadline).toISOString() : null,
          start_date: startDate ? new Date(startDate).toISOString() : null,
          end_date: endDate ? new Date(endDate).toISOString() : null,
          prize_pool: prizePool.trim() || null,
          description: description.trim() || null,
          eligibility: eligibility.trim() || null,
          themes: themes.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12),
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 409) {
        setSubmitError(data?.error || "You already suggested this event.");
        return;
      }
      if (!res.ok) {
        const details = Array.isArray(data?.details) ? ` ${data.details.join(" ")}` : "";
        throw new Error((data?.error || "Could not submit your suggestion.") + details);
      }
      setSubmitNotice("Suggestion received. A PulsePoint curator will review it — nothing is published automatically.");
      resetForm();
      setMineRefresh((count) => count + 1);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not submit your suggestion.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-space-black text-warm-white flex flex-col">
      {/* Nav */}
      <nav className="border-b border-charcoal-700 bg-space-black/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/hackathons" aria-label="Back to hackathons">
            <PulsePointWordmark markClassName="w-7 h-7" className="text-lg" />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/hackathons" className="text-xs font-medium text-warm-white-muted hover:text-warm-white transition-colors">
              ← Catalog
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-10 flex-1">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold font-serif text-warm-white tracking-tight">Suggest a hackathon</h1>
          <p className="mt-2 text-sm text-warm-white-muted leading-relaxed max-w-2xl">
            Know a verified hackathon? Send the official links — a PulsePoint curator will check them and
            publish it. Suggestions are never published automatically.
          </p>
          <p className="mt-3 inline-flex items-center gap-2 text-xs text-warm-white-muted">
            <ShieldIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Only events with genuine official registration links go live.
          </p>
        </div>

        {!authReady ? (
          <p role="status" className="text-sm text-warm-white-muted">Checking your sign-in…</p>
        ) : !currentUser ? (
          <div className="rounded-2xl border border-charcoal-700 bg-charcoal-900 p-8 text-center">
            <h2 className="text-xl font-bold font-serif mb-2">Sign in to suggest an event</h2>
            <p className="text-xs text-warm-white-muted mb-6">We need to know who submitted the suggestion — curators review every one.</p>
            <Link href="/sign-in" className="inline-flex px-5 py-2.5 rounded-xl bg-crimson hover:bg-crimson-hover text-white text-xs font-semibold transition-colors">
              Sign in
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="rounded-2xl border border-charcoal-700 bg-charcoal-900 p-6 sm:p-8 space-y-5">
              {submitError && (
                <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-600/30 bg-rose-600/10 px-4 py-3 text-xs text-rose-800 dark:text-rose-300">
                  <AlertCircleIcon className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{submitError}</span>
                </p>
              )}
              {submitNotice && (
                <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-600/30 bg-emerald-600/10 px-4 py-3 text-xs text-emerald-800 dark:text-emerald-300">
                  <CheckCircleIcon className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{submitNotice}</span>
                </p>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="s-title" className={labelClass}>Event title *</label>
                  <input id="s-title" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="e.g. SIH 2026 — Software Edition" maxLength={160} />
                </div>

                <div>
                  <label htmlFor="s-organizer" className={labelClass}>Organizer</label>
                  <input id="s-organizer" value={organizer} onChange={(e) => setOrganizer(e.target.value)} className={inputClass} placeholder="Organizer / hosting body" maxLength={160} />
                </div>

                <div>
                  <label htmlFor="s-mode" className={labelClass}>Format</label>
                  <select id="s-mode" value={mode} onChange={(e) => setMode(e.target.value)} className={inputClass}>
                    <option value="">Not listed</option>
                    <option value="Online">Online</option>
                    <option value="In Person">In Person</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="s-source" className={labelClass}>Official listing page *</label>
                  <input id="s-source" required type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className={inputClass} placeholder="https://organizer.com/hackathon" maxLength={2048} />
                  <p className="mt-1 text-[11px] text-warm-white-muted">Where a student can read about the event officially.</p>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="s-apply" className={labelClass}>Official registration link *</label>
                  <input id="s-apply" required type="url" value={applyUrl} onChange={(e) => setApplyUrl(e.target.value)} className={inputClass} placeholder="https://organizer.com/register" maxLength={2048} />
                  <p className="mt-1 text-[11px] text-warm-white-muted">The exact URL students must open to register. PulsePoint never brokers applications.</p>
                </div>

                <div>
                  <label htmlFor="s-location" className={labelClass}>Location</label>
                  <input id="s-location" value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} placeholder="City / Online / Worldwide" maxLength={160} />
                </div>

                <div>
                  <label htmlFor="s-prize" className={labelClass}>Prize pool</label>
                  <input id="s-prize" value={prizePool} onChange={(e) => setPrizePool(e.target.value)} className={inputClass} placeholder="e.g. ₹1,50,000 or “Prizes worth $10,000”" maxLength={200} />
                </div>

                <div>
                  <label htmlFor="s-deadline" className={labelClass}>Registration deadline</label>
                  <input id="s-deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
                </div>

                <div>
                  <label htmlFor="s-theme" className={labelClass}>Themes (comma separated)</label>
                  <input id="s-theme" value={themes} onChange={(e) => setThemes(e.target.value)} className={inputClass} placeholder="AI/ML, Web Development" maxLength={400} />
                </div>

                <div>
                  <label htmlFor="s-start" className={labelClass}>Start date</label>
                  <input id="s-start" type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
                </div>

                <div>
                  <label htmlFor="s-end" className={labelClass}>End date</label>
                  <input id="s-end" type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="s-description" className={labelClass}>Short description</label>
                  <textarea id="s-description" value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} min-h-24`} maxLength={4000} placeholder="What is the event about? Copy the official summary in your own words." />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="s-eligibility" className={labelClass}>Who can participate</label>
                  <input id="s-eligibility" value={eligibility} onChange={(e) => setEligibility(e.target.value)} className={inputClass} maxLength={2000} placeholder="e.g. Students from any college, teams of 2–4" />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-[11px] text-warm-white-muted max-w-sm">
                  By submitting you confirm these links are official and public. Duplicate submissions are merged by our curators.
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 rounded-xl bg-crimson hover:bg-crimson-hover text-white text-xs font-bold transition-colors disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : "Submit for review"}
                </button>
              </div>
            </form>

            {/* My suggestions */}
            <section className="mt-8">
              <h2 className="text-sm font-bold uppercase tracking-wider text-warm-white-muted mb-3">Your suggestions</h2>
              {myError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300 mb-3">{myError}</p>}
              {mySuggestions.length === 0 ? (
                <p className="text-xs text-warm-white-muted">You have not suggested any events yet.</p>
              ) : (
                <ul className="space-y-2">
                  {mySuggestions.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-charcoal-700 bg-charcoal-900 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-warm-white line-clamp-1">{s.title}</p>
                        <p className="text-[11px] text-warm-white-muted">
                          Submitted {new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          {s.review_notes ? ` · Curator note: ${s.review_notes}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${STATUS_PILL[s.status]}`}>
                          {s.status === "published" ? "Published ✓" : s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                        </span>
                        {s.published_hackathon_id && (
                          <Link href={`/hackathons/${s.published_hackathon_id}`} className="text-[11px] text-crimson hover:underline">
                            View listing
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-charcoal-700 py-6 text-center text-xs text-warm-white-muted">
        © 2026 PulsePoint · Suggestions are reviewed by humans before they ever reach the catalog
      </footer>
    </div>
  );
}
