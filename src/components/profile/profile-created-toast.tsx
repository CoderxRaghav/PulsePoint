"use client";

import { useEffect, useState } from "react";

export function ProfileCreatedToast({ uid }: { uid: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("created") !== "1") return;

    const notificationKey = `pulsepoint-profile-created:${uid}`;
    let alreadyShown = false;
    try {
      alreadyShown = window.sessionStorage.getItem(notificationKey) === "shown";
      if (!alreadyShown) window.sessionStorage.setItem(notificationKey, "shown");
    } catch {
      // Removing the URL marker still prevents a repeat when session storage is unavailable.
    }

    url.searchParams.delete("created");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    if (!alreadyShown) queueMicrotask(() => setVisible(true));
  }, [uid]);

  useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(timeout);
  }, [visible]);

  if (!visible) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="profile-created-toast fixed inset-x-4 top-4 z-[100] mx-auto max-w-lg rounded-2xl border border-emerald-400/20 bg-[#12131b]/95 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:top-6 sm:w-[min(28rem,calc(100vw-3rem))] sm:p-5"
    >
      <div className="flex items-start gap-4">
        <div className="profile-created-indicator flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
            <path
              d="m6 12.5 4 4L18.5 8"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="profile-created-check"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold text-white sm:text-base">Profile Created Successfully!</p>
          <p className="mt-1.5 text-xs leading-relaxed text-neutral-300 sm:text-sm">
            Your PulsePoint profile is ready. You can now connect with teammates and explore opportunities.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Dismiss success notification"
          className="-mr-1 -mt-1 rounded-lg px-2 py-1 text-lg leading-none text-neutral-500 transition hover:bg-white/5 hover:text-white"
        >
          ×
        </button>
      </div>
    </aside>
  );
}
