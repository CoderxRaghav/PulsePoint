"use client";

import { MoonIcon, SunIcon } from "@/components/ui/icons";
import { useTheme } from "@/components/ui/theme-provider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-pressed={isDark}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={`theme-toggle inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border p-2 transition-colors ${className}`}
    >
      {isDark ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
    </button>
  );
}
