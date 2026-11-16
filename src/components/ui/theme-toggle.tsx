"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "@/components/ui/icons";
import { useTheme } from "@/components/ui/theme-provider";

const emptySubscribe = () => () => {};

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  // Client snapshot reports "mounted" on the client only — no effect needed.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const isDark = theme === "dark";
  const target = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={mounted ? `Switch to ${target} mode` : "Toggle color theme"}
      aria-pressed={mounted ? isDark : undefined}
      title={mounted ? `Switch to ${target} mode` : "Toggle color theme"}
      className={`theme-toggle inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border p-2 transition-colors ${className}`}
    >
      {mounted ? (
        isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />
      ) : (
        // SSR and first client render agree on a neutral placeholder; the icon
        // reflects the active theme once the client snapshot is known.
        <span className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}
