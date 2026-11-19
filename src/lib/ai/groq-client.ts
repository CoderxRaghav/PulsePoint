import "server-only";

/**
 * Server-only Groq adapter for the Phase 7A assistant.
 *
 * Model configuration is centralized here — do not hard-code the model,
 * endpoint, or request parameters anywhere else. The API key is read from
 * the server-only GROQ_API_KEY environment variable and is never logged,
 * returned to the client, or embedded in error messages.
 *
 * Verified against official Groq documentation (November 2026):
 * - POST https://api.groq.com/openai/v1/chat/completions (OpenAI-compatible)
 * - openai/gpt-oss-20b is a production model (~1,000 tok/s, 131,072 context)
 * - GPT-OSS models support reasoning_effort (low/medium/high) and
 *   include_reasoning; reasoning_format is NOT supported.
 * Free-tier (org-level, as of Nov 2026, subject to change by Groq):
 * 30 RPM / 1,000 RPD / 8K TPM / 200K TPD. Requests are therefore compact.
 */

export const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_ASSISTANT_MODEL = "openai/gpt-oss-20b";

export const GROQ_MAX_COMPLETION_TOKENS = 640;
export const GROQ_TEMPERATURE = 0.6;
export const GROQ_TOP_P = 0.95;
export const GROQ_REASONING_EFFORT = "low" as const;

export const GROQ_REQUEST_TIMEOUT_MS = 20_000;
export const GROQ_MAX_RETRY_AFTER_SECONDS = 300;

export interface GroqChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class GroqError extends Error {
  readonly kind:
    | "not_configured"
    | "rate_limited"
    | "timeout"
    | "server_error"
    | "client_error"
    | "malformed_response";
  readonly retryAfterSeconds: number | null;

  constructor(kind: GroqError["kind"], message: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "GroqError";
    this.kind = kind;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isGroqConfigured(): boolean {
  return typeof process.env.GROQ_API_KEY === "string" && process.env.GROQ_API_KEY.trim().length > 0;
}

export function isAssistantEnabled(): boolean {
  // Safe default: anything other than the exact string "true" disables the assistant.
  return process.env.AI_ASSISTANT_ENABLED === "true";
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(Math.ceil(seconds), GROQ_MAX_RETRY_AFTER_SECONDS);
}

interface GroqCompletionResponse {
  choices?: Array<{ message?: { content?: unknown } }>;
}

/**
 * Calls Groq Chat Completions with a bounded timeout.
 * Throws GroqError on any failure. Never logs request contents, response
 * contents, or the API key. Does not retry — callers surface honest errors.
 */
export async function createGroqChatCompletion(messages: GroqChatMessage[]): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new GroqError("not_configured", "The assistant is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GROQ_REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_ASSISTANT_MODEL,
        messages,
        temperature: GROQ_TEMPERATURE,
        top_p: GROQ_TOP_P,
        max_completion_tokens: GROQ_MAX_COMPLETION_TOKENS,
        reasoning_effort: GROQ_REASONING_EFFORT,
        include_reasoning: false,
        stream: false,
      }),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "AbortError" || controller.signal.aborted) {
      throw new GroqError("timeout", "The assistant took too long to respond.");
    }
    throw new GroqError("server_error", "The assistant provider could not be reached.");
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    throw new GroqError(
      "rate_limited",
      "The assistant is busy right now. Please try again shortly.",
      parseRetryAfter(response.headers.get("retry-after")),
    );
  }
  if (response.status >= 500) {
    // Log only the status code — never the body (may echo prompt content or internals).
    console.error(`[assistant] Groq upstream server error: HTTP ${response.status}`);
    throw new GroqError("server_error", "The assistant provider is unavailable.");
  }
  if (!response.ok) {
    console.error(`[assistant] Groq upstream client error: HTTP ${response.status}`);
    throw new GroqError("client_error", "The assistant provider rejected the request.");
  }

  let payload: GroqCompletionResponse;
  try {
    payload = (await response.json()) as GroqCompletionResponse;
  } catch {
    throw new GroqError("malformed_response", "The assistant provider returned an unreadable response.");
  }

  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new GroqError("malformed_response", "The assistant provider returned an empty response.");
  }
  return content.trim();
}
