"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import { subscribeToAuthChanges } from "@/lib/firebase";
import { CloseIcon, RefreshCwIcon, AlertCircleIcon, ShieldIcon } from "@/components/ui/icons";
import { trimAssistantHistory } from "@/lib/assistant-history";

type ChatMessage = { role: "user" | "assistant"; content: string };

type Phase = "loading" | "signed-out" | "disabled" | "ready" | "error";

const MAX_MESSAGE_CHARS = 2000;

const FAQ_QUESTIONS = [
  "What is PulsePoint?",
  "How can I find a team?",
  "How does team matching work?",
  "Where can I discover hackathons?",
  "How can I manage my project tasks?",
] as const;

const WELCOME_MESSAGE =
  "Hey there! 👋 I'm your PulsePoint AI assistant. I can help you explore PulsePoint, understand its features, and guide you through your projects.";

// Green robot theme (2026-11-17):
// lime #9DD923 · darker green #65A30D · user bubble #EAF8D8 · visor dark green.
const LIME = "#9DD923";
const LIME_DARK = "#65A30D";
const LIME_HOVER = "#4D7C0F";
const LIME_USER = "#EAF8D8";
const LIME_ASSISTANT = "#F7FCF0";
const LIME_SOFT = "#F4FBEA";
const LIME_BORDER = "#CFE3AE";
const LIME_BORDER_STRONG = "#DBEAC8";
const INK = "#20301A";
const INK_SOFT = "#4A6B1A";
const VISOR = "#1F3A08";

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

type RobotTone = "mascot" | "green";

/**
 * Lightweight friendly robot mascot (SVG, no assets).
 * "mascot": white body + dark visor + lime eyes — for use on green/lime surfaces.
 * "green": lime-dark body — for use inside light-green containers (e.g. header).
 */
function RobotIcon({ className = "h-8 w-8", tone = "mascot" }: { className?: string; tone?: RobotTone }) {
  const body = tone === "mascot" ? "#FFFFFF" : LIME_DARK;
  const visor = tone === "mascot" ? VISOR : "#FFFFFF";
  const eye = tone === "mascot" ? LIME : LIME_DARK;
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {/* antenna */}
      <path d="M32 5v8" stroke={body} strokeWidth="3.6" strokeLinecap="round" />
      <circle cx="32" cy="4.4" r="3.6" fill={body} />
      {/* ear pods */}
      <rect x="4.5" y="27" width="6" height="13" rx="2.6" fill={body} />
      <rect x="53.5" y="27" width="6" height="13" rx="2.6" fill={body} />
      {/* dome head */}
      <rect x="9" y="15" width="46" height="37" rx="14" fill={body} />
      {/* visor */}
      <rect x="15" y="21.5" width="34" height="24" rx="9" fill={visor} />
      {/* eyes (big, friendly) */}
      <circle cx="25.5" cy="32.5" r="3.4" fill={eye} />
      <circle cx="38.5" cy="32.5" r="3.4" fill={eye} />
      {/* smile */}
      <path d="M26.5 39.4c1.9 1.8 3.6 2.6 5.5 2.6s3.6-.8 5.5-2.6" stroke={eye} strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 11.2 19 4.6a.6.6 0 0 1 .8.8l-6.6 14.5a.6.6 0 0 1-1.1.1l-2.4-6-5.7-2.3a.6.6 0 0 1 0-1.5Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AssistantAvatar() {
  return (
    <span
      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
      style={{ background: `linear-gradient(150deg, ${LIME} 0%, ${LIME_DARK} 130%)` }}
    >
      <RobotIcon className="h-5 w-5" tone="mascot" />
    </span>
  );
}

function AvailabilityDot({ phase }: { phase: Phase }) {
  if (phase === "ready") {
    return (
      <span className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: INK }}>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "#16A34A" }} />
          <span className="relative inline-flex h-2 w-2 rounded-full ring-1 ring-white" style={{ background: "#16A34A" }} />
        </span>
        Online
      </span>
    );
  }
  if (phase === "loading") {
    return <span className="text-[10px] font-medium" style={{ color: INK_SOFT }}>Checking…</span>;
  }
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: INK_SOFT }}>
      <span className="inline-flex h-2 w-2 rounded-full ring-1 ring-white/70" style={{ background: "#78716C" }} />
      Unavailable
    </span>
  );
}

export function AssistantWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);

  useEffect(() => subscribeToAuthChanges((active) => {
    setUser(active);
    setPhase(active ? "loading" : "signed-out");
  }), []);

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
        if (response.status === 401) { routerRef.current.replace(`/sign-in?next=${encodeURIComponent("/")}`); return; }
        const body = (await response.json().catch(() => ({}))) as { enabled?: boolean };
        setPhase(body.enabled === true ? "ready" : "disabled");
      })
      .catch(() => {
        if (active) setPhase("error");
      });
    return () => { active = false; };
  }, [user]);

  // Close on Escape; close on outside pointer down (does not block chat clicks).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  // Return focus to the toggle after the panel has fully unmounted — React's
  // unmount flush can reset focus, so this runs post-commit, not in the handler.
  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (prevOpenRef.current && !open) toggleRef.current?.focus();
    prevOpenRef.current = open;
  }, [open]);

  // Focus the composer when the panel opens and the assistant is usable.
  useEffect(() => {
    if (open && phase === "ready") inputRef.current?.focus();
  }, [open, phase]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (typeof el.scrollTo === "function") el.scrollTo({ top: el.scrollHeight });
    else el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const sendMessage = async (rawText: string) => {
    if (!user || sendingRef.current) return;
    const text = rawText.trim();
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
        router.replace(`/sign-in?next=${encodeURIComponent("/")}`);
        return;
      }

      const body = (await response.json().catch(() => ({}))) as {
        message?: { content?: string };
        error?: string;
        retryAfterSeconds?: number;
      };

      if (!response.ok) {
        setError(statusMessage(response.status, body.retryAfterSeconds, body.error));
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

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const resetConversation = () => {
    setMessages([]);
    setError("");
    setInput("");
  };

  return (
    <div
      ref={containerRef}
      className="fixed z-[55] flex flex-col items-end gap-3"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))", right: "max(1rem, env(safe-area-inset-right))" }}
    >
      {open && (
        <section
          id="pulsepoint-ai-panel"
          role="dialog"
          aria-modal="false"
          aria-label="PulsePoint AI assistant"
          className="assistant-panel-in flex h-[min(520px,72vh)] min-h-[420px] w-[min(400px,calc(100vw-2rem))] origin-bottom-right flex-col overflow-hidden rounded-3xl border shadow-2xl"
          style={{
            background: "#FFFFFF",
            color: INK,
            borderColor: LIME_BORDER,
            boxShadow: "0 24px 60px -12px rgba(31, 58, 8, 0.35)",
          }}
        >
          {/* Header (green theme) */}
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{
              background: `linear-gradient(120deg, ${LIME} 0%, #8ACB21 55%, ${LIME_DARK} 130%)`,
              color: INK,
            }}
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: "#EAFBD0", boxShadow: "inset 0 0 0 1px rgba(31,58,8,0.12)" }}
            >
              <RobotIcon className="h-8 w-8" tone="green" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold leading-tight tracking-tight" style={{ color: INK }}>PulsePoint AI</span>
              <span className="block text-[10px] font-medium leading-tight" style={{ color: INK_SOFT }}>Your project and hackathon companion</span>
              <AvailabilityDot phase={phase} />
            </span>
            {phase === "ready" && messages.length > 0 && (
              <button
                type="button"
                onClick={resetConversation}
                aria-label="Start a new chat"
                title="Start a new chat"
                className="rounded-xl p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D]"
                style={{ color: INK, background: "transparent" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(31,58,8,0.12)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <RefreshCwIcon className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="rounded-xl p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D]"
              style={{ color: INK }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(31,58,8,0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          {phase === "loading" && (
            <p role="status" className="flex flex-1 items-center justify-center px-6 text-center text-xs" style={{ color: INK_SOFT }}>
              Checking assistant availability…
            </p>
          )}

          {phase === "signed-out" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-3xl" style={{ background: LIME_SOFT }}>
                <RobotIcon className="h-11 w-11" tone="green" />
              </span>
              <p className="text-sm font-bold" style={{ color: INK }}>Sign in to chat</p>
              <p className="text-xs leading-5" style={{ color: INK_SOFT }}>The PulsePoint AI assistant is available to signed-in students.</p>
              <Link
                href={`/sign-in?next=${encodeURIComponent("/")}`}
                className="mt-1 rounded-xl px-5 py-2.5 text-xs font-bold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D] focus-visible:ring-offset-2"
                style={{ background: LIME_DARK }}
                onMouseEnter={(e) => { e.currentTarget.style.background = LIME_HOVER; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = LIME_DARK; }}
              >
                Sign in to continue
              </Link>
            </div>
          )}

          {phase === "disabled" && (
            <div role="status" className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-3xl" style={{ background: LIME_SOFT }}>
                <RobotIcon className="h-11 w-11" tone="green" />
              </span>
              <p className="text-sm font-bold" style={{ color: INK }}>Assistant unavailable</p>
              <p className="text-xs leading-5" style={{ color: INK_SOFT }}>
                PulsePoint AI is turned off right now and will only be switched on once it is fully verified. Please check back later.
              </p>
            </div>
          )}

          {phase === "error" && (
            <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <AlertCircleIcon className="h-8 w-8" style={{ color: LIME_DARK }} />
              <p className="text-sm font-bold" style={{ color: INK }}>Couldn&apos;t reach the assistant</p>
              <p className="text-xs leading-5" style={{ color: INK_SOFT }}>We couldn&apos;t check whether PulsePoint AI is available. Check your connection and try again.</p>
              <button
                type="button"
                onClick={() => {
                  if (user) {
                    setPhase("loading");
                    user.getIdToken()
                      .then((token) => fetch("/api/ai/assistant", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }))
                      .then(async (response) => {
                        const body = (await response.json().catch(() => ({}))) as { enabled?: boolean };
                        setPhase(body.enabled === true ? "ready" : "disabled");
                      })
                      .catch(() => setPhase("error"));
                  } else {
                    setPhase("signed-out");
                  }
                }}
                className="mt-1 rounded-xl border px-4 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D]"
                style={{ borderColor: LIME_BORDER, color: INK }}
                onMouseEnter={(e) => { e.currentTarget.style.background = LIME_SOFT; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                Retry
              </button>
            </div>
          )}

          {phase === "ready" && (
            <>
              {/* Privacy disclosure */}
              <div className="border-b px-3 py-1.5" style={{ borderColor: LIME_BORDER_STRONG, background: LIME_SOFT }}>
                <p className="flex items-start gap-1.5 text-[10px] leading-4" style={{ color: INK_SOFT }}>
                  <ShieldIcon className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>
                    Messages and selected PulsePoint context are processed by Groq, a third-party provider. The context may include your profile, teams, project details, minimized task information (title, status, due date, whether a task is assigned to you — never other members&apos; identities), and your saved hackathons. PulsePoint does not store this conversation. AI answers can be wrong — verify important info. AI responses are informational and are not legal, medical, or financial advice. Never share passwords or other people&apos;s data.{" "}
                    <Link href="/legal" className="underline underline-offset-2" style={{ color: LIME_DARK }}>Privacy notice</Link>
                  </span>
                </p>
              </div>

              {/* Messages */}
              <div
                ref={scrollRef}
                role="log"
                aria-live="polite"
                aria-label="Conversation"
                className="flex-1 space-y-3 overflow-y-auto px-3 py-3"
                style={{ background: "#FFFFFF" }}
              >
                {/* Welcome + FAQs (only before the first user message) */}
                <div className="flex items-start gap-2">
                  <AssistantAvatar />
                  <p
                    className="rounded-2xl rounded-tl-md border px-3 py-2 text-xs leading-5"
                    style={{ background: LIME_ASSISTANT, borderColor: LIME_BORDER_STRONG, color: INK }}
                  >
                    {WELCOME_MESSAGE}
                  </p>
                </div>

                {messages.length === 0 && (
                  <div className="space-y-2 pl-9">
                    <div className="grid gap-1.5">
                      {FAQ_QUESTIONS.map((question) => (
                        <button
                          key={question}
                          type="button"
                          onClick={() => void sendMessage(question)}
                          disabled={sending}
                          className="group flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-left text-[11px] font-medium leading-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D] disabled:opacity-60"
                          style={{ borderColor: LIME_BORDER_STRONG, color: INK }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = LIME_USER; e.currentTarget.style.borderColor = LIME; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.borderColor = LIME_BORDER_STRONG; }}
                        >
                          {question}
                          <span aria-hidden="true" className="font-bold" style={{ color: LIME_DARK }}>→</span>
                        </button>
                      ))}
                    </div>
                    <p className="pt-1 text-center text-[10px] font-semibold" style={{ color: LIME_DARK }}>Have another question? Feel free to ask!</p>
                  </div>
                )}

                {messages.map((message, index) => (
                  <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} gap-2`}>
                    {message.role === "assistant" && <AssistantAvatar />}
                    <p
                      className="max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-5"
                      style={message.role === "user"
                        ? { background: LIME_USER, color: INK, borderTopRightRadius: "0.375rem" }
                        : { background: LIME_ASSISTANT, color: INK, border: `1px solid ${LIME_BORDER_STRONG}`, borderTopLeftRadius: "0.375rem" }}
                    >
                      {message.content}
                    </p>
                  </div>
                ))}

                {sending && (
                  <div className="flex items-start gap-2" role="status" aria-label="Assistant is typing">
                    <AssistantAvatar />
                    <span
                      className="flex items-center gap-1 rounded-2xl rounded-tl-md px-4 py-3"
                      style={{ background: LIME_ASSISTANT, border: `1px solid ${LIME_BORDER_STRONG}` }}
                    >
                      {[0, 1, 2].map((dot) => (
                        <span key={dot} className="assistant-typing-dot h-1.5 w-1.5 rounded-full" style={{ background: LIME_DARK }} />
                      ))}
                    </span>
                  </div>
                )}
              </div>

              {error && (
                <p role="alert" className="mx-3 flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[11px] leading-4 text-rose-700 dark:text-rose-300">
                  <AlertCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
                </p>
              )}

              {/* Composer */}
              <form onSubmit={submit} className="border-t px-3 pb-2 pt-2" style={{ borderColor: LIME_BORDER_STRONG }}>
                <div className="flex items-end gap-2">
                  <label htmlFor="assistant-widget-input" className="sr-only">Ask me anything</label>
                  <textarea
                    id="assistant-widget-input"
                    ref={inputRef}
                    value={input}
                    rows={1}
                    maxLength={MAX_MESSAGE_CHARS}
                    disabled={sending}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder="Ask me anything..."
                    className="max-h-28 min-h-[38px] flex-1 resize-none rounded-2xl border px-3 py-2 text-xs leading-5 placeholder:opacity-80 focus:outline-none disabled:opacity-60"
                    style={{
                      borderColor: LIME_BORDER,
                      background: "#FDFEF8",
                      color: INK,
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = LIME_DARK; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(157, 217, 35, 0.45)`; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = LIME_BORDER; e.currentTarget.style.boxShadow = "none"; }}
                  />
                  <button
                    type="submit"
                    disabled={sending || input.trim().length === 0}
                    aria-label="Send message"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D] disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: LIME, color: VISOR }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = LIME_DARK; e.currentTarget.style.color = "#FFFFFF"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = LIME; e.currentTarget.style.color = VISOR; }}
                  >
                    <SendIcon className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-1 text-center text-[9px] leading-3" style={{ color: INK_SOFT }}>
                  AI-generated — responses can be wrong. PulsePoint does not store this conversation.
                </p>
              </form>
            </>
          )}
        </section>
      )}

      {/* Floating toggle — bright lime robot button */}
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="pulsepoint-ai-panel"
        aria-label={open ? "Close Ask AI assistant" : "Ask AI — open PulsePoint AI assistant"}
        title="Chat with PulsePoint AI"
        className="assistant-float group flex flex-col items-center gap-1.5 focus-visible:outline-none"
      >
        <span
          className="relative flex h-16 w-16 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110 group-focus-visible:scale-110 group-focus-visible:ring-4 group-focus-visible:ring-[#65A30D]"
          style={{
            background: `radial-gradient(circle at 32% 28%, #C4F85B 0%, ${LIME} 55%, #8ACC1F 100%)`,
            boxShadow: "0 12px 32px -6px rgba(101, 163, 13, 0.65), 0 0 0 6px rgba(157, 217, 35, 0.18)",
          }}
        >
          <RobotIcon className="h-10 w-10 drop-shadow" tone="mascot" />
          {phase === "ready" && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-4 w-4 rounded-full border-2 bg-emerald-400" style={{ borderColor: LIME }} />
            </span>
          )}
        </span>
        <span
          className="rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] shadow-md transition"
          style={{ background: "#1F3A08", color: "#D8F99D" }}
        >
          Ask AI
        </span>
      </button>
    </div>
  );
}
