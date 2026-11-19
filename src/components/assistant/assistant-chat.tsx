"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import { subscribeToAuthChanges } from "@/lib/firebase";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AlertCircleIcon, PulsePointIcon, SparklesIcon } from "@/components/ui/icons";
import { trimAssistantHistory } from "@/lib/assistant-history";

type ChatMessage = { role: "user" | "assistant"; content: string };

type LoadState = "loading" | "disabled" | "ready" | "error";

const MAX_MESSAGE_CHARS = 2000;

const DISCLOSURE_POINTS = [
  "Your messages and the PulsePoint context assembled for your question are sent to Groq, a third-party inference provider, to generate a response. That context may include your profile, your teams, project details, minimized task information (title, status, due date, and whether a task is assigned to you), and your saved hackathons. Task details and other members' identities (names, emails, UIDs) are never included. Groq processes data on US infrastructure.",
  "PulsePoint does not store your conversation — no chat history is kept in our database; refreshing this page loses it.",
  "AI responses may be inaccurate and can be outdated. Verify important information against official sources.",
  "AI responses are informational and are not legal, medical, or financial advice.",
  "Do not enter passwords, private keys, government IDs, or other people's private information.",
];

/**
 * Returns a server-authored error string only when it looks like a short,
 * single-line, human-readable message. Anything that resembles a stack
 * trace, a file path, or credential material is rejected outright.
 */
function safeServerError(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 240) return null;
  if (/[\r\n]/.test(trimmed)) return null;
  if (/(node_modules|\bat\s+\S+\s*\(|stack trace|bearer\s|api[_-]?key|secret|-----BEGIN)/i.test(trimmed)) return null;
  return trimmed;
}

function statusMessage(status: number, retryAfterSeconds?: number, serverError?: unknown): string {
  switch (status) {
    case 401:
      return "Your session expired. Redirecting to sign in…";
    case 429:
      return retryAfterSeconds
        ? `The assistant is busy. Try again in about ${retryAfterSeconds >= 60 ? `${Math.ceil(retryAfterSeconds / 60)} minute(s)` : `${retryAfterSeconds} second(s)`}.`
        : "The assistant is busy right now. Please try again shortly.";
    case 502:
      return "The assistant returned an invalid response. Please try again.";
    case 503:
      return "The assistant is temporarily unavailable. Please try again later.";
    case 504:
      return "The assistant took too long to respond. Please try again.";
    default:
      return safeServerError(serverError) ?? "The assistant hit an unexpected error. Please try again in a moment.";
  }
}

export function AssistantChat() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);

  useEffect(() => subscribeToAuthChanges((active) => {
    setUser(active);
    if (!active) router.replace(`/sign-in?next=${encodeURIComponent("/assistant")}`);
  }), [router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    user.getIdToken()
      .then((token) => fetch("/api/ai/assistant", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }))
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) { routerRef.current.replace(`/sign-in?next=${encodeURIComponent("/assistant")}`); return; }
        const body = (await response.json().catch(() => ({}))) as { enabled?: boolean };
        setState(body.enabled === true ? "ready" : "disabled");
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (typeof el.scrollTo === "function") el.scrollTo({ top: el.scrollHeight });
    else el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || sendingRef.current) return;
    const text = input.trim();
    if (!text) return;

    const trimmedHistory = trimAssistantHistory([...messages, { role: "user" as const, content: text }]);
    setMessages(trimmedHistory);
    setInput("");
    setError("");
    sendingRef.current = true;
    setSending(true);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/ai/assistant", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: trimmedHistory }),
      });

      if (response.status === 401) {
        router.replace(`/sign-in?next=${encodeURIComponent("/assistant")}`);
        return;
      }

      const body = (await response.json().catch(() => ({}))) as {
        message?: { role?: string; content?: string };
        error?: string;
        retryAfterSeconds?: number;
      };

      if (!response.ok) {
        setError(statusMessage(response.status, body.retryAfterSeconds, body.error));
        // Keep the user's message visible so they can retry or rephrase.
        return;
      }

      const content = body.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        setError("The assistant returned an invalid response. Please try again.");
        return;
      }
      setMessages((current) => [...current, { role: "assistant", content }]);
    } catch {
      setError("Network request failed. Check your connection and try again.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const resetConversation = () => {
    setMessages([]);
    setError("");
    setInput("");
  };

  return (
    <div className="flex min-h-screen flex-col bg-space-black text-warm-white">
      <header className="sticky top-0 z-30 border-b border-charcoal-700 bg-space-black/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-warm-white transition hover:text-crimson" aria-label="PulsePoint home">
            <PulsePointIcon className="h-7 w-7" />
            <span className="team-heading text-lg font-bold tracking-tight">PulsePoint <span className="text-crimson">Assistant</span></span>
          </Link>
          <div className="flex items-center gap-2">
            {state === "ready" && messages.length > 0 && (
              <button
                type="button"
                onClick={resetConversation}
                className="rounded-lg px-3 py-2 text-sm font-medium text-warm-white-muted transition hover:bg-charcoal-800 hover:text-warm-white"
              >
                New chat
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6">
        {state === "loading" && (
          <p role="status" className="py-16 text-center text-sm text-warm-white-muted">Checking assistant availability…</p>
        )}

        {state === "error" && (
          <div role="alert" className="mx-auto mt-12 max-w-md rounded-2xl border border-charcoal-700 bg-charcoal-900 p-6 text-center">
            <AlertCircleIcon className="mx-auto h-8 w-8 text-crimson" />
            <h1 className="team-heading mt-3 text-xl font-bold">Couldn&apos;t reach the assistant</h1>
            <p className="mt-2 text-sm text-warm-white-muted">We couldn&apos;t check whether the assistant is available. Check your connection and reload the page.</p>
          </div>
        )}

        {state === "disabled" && (
          <div role="status" className="mx-auto mt-12 max-w-md rounded-2xl border border-charcoal-700 bg-charcoal-900 p-6 text-center">
            <SparklesIcon className="mx-auto h-8 w-8 text-warm-white-muted" />
            <h1 className="team-heading mt-3 text-xl font-bold">Assistant unavailable</h1>
            <p className="mt-2 text-sm leading-6 text-warm-white-muted">
              The PulsePoint AI Assistant is not enabled right now. It is turned off by default and will only be
              switched on after it is fully verified. Check back later.
            </p>
            <Link href="/" className="mt-5 inline-flex items-center justify-center rounded-xl bg-crimson px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-crimson-hover">
              Back to PulsePoint
            </Link>
          </div>
        )}

        {state === "ready" && (
          <>
            <section aria-label="Privacy notice" className="rounded-2xl border border-charcoal-700 bg-charcoal-900/60 px-4 py-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-warm-white-muted">
                <SparklesIcon className="h-4 w-4 text-crimson" /> Before you ask
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-warm-white-muted">
                {DISCLOSURE_POINTS.map((point) => <li key={point}>{point}</li>)}
              </ul>
              <p className="mt-2 text-xs leading-5 text-warm-white-muted">
                <Link href="/legal" className="underline underline-offset-2 transition hover:text-warm-white">
                  Privacy notice
                </Link>
              </p>
            </section>

            <div
              ref={scrollRef}
              role="log"
              aria-live="polite"
              aria-label="Conversation"
              className="mt-4 flex-1 space-y-4 overflow-y-auto rounded-2xl border border-charcoal-700 bg-charcoal-900/40 p-4"
            >
              {messages.length === 0 ? (
                <div className="py-10 text-center">
                  <SparklesIcon className="mx-auto h-8 w-8 text-crimson" />
                  <h1 className="team-heading mt-3 text-xl font-bold">Ask PulsePoint Assistant</h1>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-warm-white-muted">
                    General study questions, interview prep, and project guidance — grounded in your own PulsePoint
                    profile, teams, projects, tasks and saved events when relevant. No real-time information, and no actions taken on your behalf.
                  </p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-6 sm:max-w-[75%] ${
                        message.role === "user"
                          ? "bg-crimson text-white"
                          : "border border-charcoal-700 bg-charcoal-800 text-warm-white"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))
              )}
              {sending && (
                <div className="flex justify-start" role="status">
                  <div className="rounded-2xl border border-charcoal-700 bg-charcoal-800 px-4 py-2.5 text-sm text-warm-white-muted">
                    Thinking…
                  </div>
                </div>
              )}
            </div>

            {error && (
              <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-2.5 text-sm text-rose-700 dark:text-rose-300">
                <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </p>
            )}

            <form onSubmit={send} className="mt-3 flex items-end gap-2">
              <label htmlFor="assistant-input" className="sr-only">Message the assistant</label>
              <textarea
                id="assistant-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                maxLength={MAX_MESSAGE_CHARS}
                rows={2}
                disabled={sending}
                placeholder="Ask a study or project question…"
                className="max-h-40 min-h-[52px] flex-1 resize-none rounded-2xl border border-charcoal-700 bg-charcoal-900 px-4 py-3 text-sm leading-6 text-warm-white placeholder:text-warm-white-muted focus:border-crimson focus:outline-none disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={sending || input.trim().length === 0}
                className="rounded-2xl bg-crimson px-5 py-3 text-sm font-semibold text-white transition hover:bg-crimson-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "…" : "Send"}
              </button>
            </form>
            <p className="mt-2 text-center text-[11px] leading-4 text-warm-white-muted">
              AI-generated — responses can be wrong. PulsePoint does not store this conversation. It cannot perform actions or access other people&apos;s data.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
