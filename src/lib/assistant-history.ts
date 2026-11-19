/**
 * Shared conversation-history trimming for the Phase 7A assistant clients.
 *
 * Pure and dependency-free: safe to import from browser bundles. The server
 * enforces at most 12 messages, 2,000 characters per message, and 8,000
 * characters in total; the client trims more conservatively (7,800) so a
 * long conversation degrades gracefully instead of getting HTTP 400.
 * The newest (user) message is always preserved.
 */

export interface AssistantHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export const ASSISTANT_MAX_HISTORY_MESSAGES = 12;
export const ASSISTANT_MAX_MESSAGE_CHARS = 2000;
export const ASSISTANT_MAX_TOTAL_CHARS = 7800;

export function trimAssistantHistory(messages: AssistantHistoryMessage[]): AssistantHistoryMessage[] {
  const kept: AssistantHistoryMessage[] = [];
  let total = 0;

  for (let index = messages.length - 1; index >= 0 && kept.length < ASSISTANT_MAX_HISTORY_MESSAGES; index -= 1) {
    const raw = messages[index];
    const content = raw.content.slice(0, ASSISTANT_MAX_MESSAGE_CHARS);
    const length = content.length;
    // The newest message is always kept; older messages are dropped once
    // either limit would be exceeded.
    if (kept.length > 0 && total + length > ASSISTANT_MAX_TOTAL_CHARS) break;
    kept.unshift({ role: raw.role, content });
    total += length;
  }

  // Outgoing context should not begin with a dangling assistant turn.
  if (kept.length > 1 && kept[0].role === "assistant") {
    kept.shift();
  }

  return kept;
}
