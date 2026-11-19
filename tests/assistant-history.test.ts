import { describe, expect, it } from "vitest";
import {
  ASSISTANT_MAX_HISTORY_MESSAGES,
  ASSISTANT_MAX_MESSAGE_CHARS,
  ASSISTANT_MAX_TOTAL_CHARS,
  trimAssistantHistory,
  type AssistantHistoryMessage,
} from "@/lib/assistant-history";

const user = (content: string): AssistantHistoryMessage => ({ role: "user", content });
const assistant = (content: string): AssistantHistoryMessage => ({ role: "assistant", content });

describe("trimAssistantHistory", () => {
  it("keeps short conversations unchanged", () => {
    const input = [user("hello"), assistant("hi"), user("how are you?")];
    expect(trimAssistantHistory(input)).toEqual(input);
  });

  it("returns a new array and does not mutate the input", () => {
    const input = [user("a".repeat(100)), assistant("b".repeat(100)), user("latest")];
    const snapshot = JSON.parse(JSON.stringify(input));
    const result = trimAssistantHistory(input);
    expect(result).not.toBe(input);
    expect(input).toEqual(snapshot);
  });

  it("trims a conversation exceeding 8,000 characters to at most 7,800", () => {
    // 6 pairs × 1900 chars each = 22,800 chars total — far over the server limit.
    const input: AssistantHistoryMessage[] = [];
    for (let i = 0; i < 6; i += 1) {
      input.push(user(`u${i} ` + "x".repeat(1900)));
      input.push(assistant(`a${i} ` + "y".repeat(1900)));
    }
    input.push(user("newest question"));

    const result = trimAssistantHistory(input);
    const totalChars = result.reduce((sum, message) => sum + message.content.length, 0);
    expect(totalChars).toBeLessThanOrEqual(ASSISTANT_MAX_TOTAL_CHARS);
    expect(totalChars).toBeLessThanOrEqual(7800);
  });

  it("always preserves the newest user message", () => {
    const input: AssistantHistoryMessage[] = [];
    for (let i = 0; i < 12; i += 1) {
      input.push(user("x".repeat(1500)));
      input.push(assistant("y".repeat(1500)));
    }
    input.push(user("the very latest question"));

    const result = trimAssistantHistory(input);
    expect(result.at(-1)).toEqual({ role: "user", content: "the very latest question" });
  });

  it("never exceeds 12 messages", () => {
    const input: AssistantHistoryMessage[] = [];
    for (let i = 0; i < 30; i += 1) input.push(user(`message ${i}`));
    const result = trimAssistantHistory(input);
    expect(result.length).toBeLessThanOrEqual(ASSISTANT_MAX_HISTORY_MESSAGES);
  });

  it("never exceeds 7,800 total characters", () => {
    const input: AssistantHistoryMessage[] = [];
    for (let i = 0; i < 12; i += 1) {
      input.push(user("u".repeat(1000 + i)));
      input.push(assistant("a".repeat(1000 + i)));
    }
    const result = trimAssistantHistory(input);
    const totalChars = result.reduce((sum, message) => sum + message.content.length, 0);
    expect(totalChars).toBeLessThanOrEqual(7800);
  });

  it("drops older messages before newer messages", () => {
    const input: AssistantHistoryMessage[] = [
      user("FIRST " + "a".repeat(2000)),
      assistant("SECOND " + "b".repeat(2000)),
      user("THIRD " + "c".repeat(2000)),
      assistant("FOURTH " + "d".repeat(2000)),
      user("FIFTH " + "e".repeat(2000)),
      user("latest"),
    ];
    const result = trimAssistantHistory(input);
    // Budget can hold the newest three full messages plus the tiny latest one, never the oldest two.
    expect(result.some((message) => message.content.startsWith("FIRST"))).toBe(false);
    expect(result.some((message) => message.content.startsWith("SECOND"))).toBe(false);
    expect(result.at(-1)?.content).toBe("latest");
  });

  it("handles a single oversized message safely by clamping it to 2,000 chars", () => {
    const input = [user("x".repeat(5000))];
    const result = trimAssistantHistory(input);
    expect(result).toHaveLength(1);
    expect(result[0].content).toHaveLength(ASSISTANT_MAX_MESSAGE_CHARS);
    expect(result[0].role).toBe("user");
  });

  it("keeps the newest user message even when only it fits the budget", () => {
    const input = [user("x".repeat(2000)), assistant("y".repeat(2000)), assistant("z".repeat(2000)), user("final")];
    const result = trimAssistantHistory(input);
    expect(result.at(-1)?.content).toBe("final");
  });

  it("never ends with an assistant message when a user message is present", () => {
    const input = [assistant("a".repeat(2000)), user("budget filler " + "b".repeat(1900)), assistant("c".repeat(2000)), user("latest question")];
    const result = trimAssistantHistory(input);
    expect(result.at(-1)?.role).toBe("user");
    expect(result[0]?.role === "assistant" ? result.length > 1 : true).toBe(true);
  });

  it("drops a dangling assistant turn at the start of the trimmed history", () => {
    const input = [
      assistant("old dangling answer that only fits if it stays"),
      user("u".repeat(3900)),
      assistant("a".repeat(3900)),
      user("latest"),
    ];
    const result = trimAssistantHistory(input);
    expect(result[0].role).toBe("user");
    expect(result.at(-1)?.content).toBe("latest");
  });
});
