// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

const mocks = vi.hoisted(() => ({
  authUser: { getIdToken: async () => "test-id-token" } as { getIdToken: () => Promise<string> } | null,
  enabled: true,
  postStatus: 200,
  postBody: { message: { role: "assistant", content: "Here is your answer." }, meta: { aiGenerated: true, contextUsed: true } } as unknown,
  fetchCalls: [] as Array<{ url: string; method: string; body?: string }>,
}));

vi.mock("@/lib/firebase", () => ({
  subscribeToAuthChanges: (callback: (user: unknown) => void) => {
    callback(mocks.authUser);
    return () => {};
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/components/ui/theme-toggle", () => ({
  ThemeToggle: () => null,
}));

const fetchMock: typeof fetch = async (input, init) => {
  const url = String(input);
  const method = init?.method ?? "GET";
  const body = typeof init?.body === "string" ? init.body : undefined;
  mocks.fetchCalls.push({ url, method, body });

  if (url === "/api/ai/assistant") {
    if (method === "POST") {
      return new Response(JSON.stringify(mocks.postBody), {
        status: mocks.postStatus,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ enabled: mocks.enabled }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  throw new Error(`Unexpected fetch in test: ${method} ${url}`);
};

import { AssistantChat } from "@/components/assistant/assistant-chat";

describe("AssistantChat — consistency with the widget", () => {
  beforeEach(() => {
    mocks.authUser = { getIdToken: async () => "test-id-token" };
    mocks.enabled = true;
    mocks.postStatus = 200;
    mocks.postBody = { message: { role: "assistant", content: "Here is your answer." }, meta: { aiGenerated: true, contextUsed: true } };
    mocks.fetchCalls.length = 0;
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("sends a typed message on Enter and shows the assistant reply", async () => {
    render(<AssistantChat />);
    const input = await screen.findByPlaceholderText("Ask a study or project question…");
    fireEvent.change(input, { target: { value: "How do I reverse a list?" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    expect(await screen.findByText("Here is your answer.")).toBeTruthy();
    const posts = mocks.fetchCalls.filter((call) => call.method === "POST");
    expect(posts).toHaveLength(1);
    const payload = JSON.parse(posts[0].body ?? "{}") as { messages?: Array<{ role: string; content: string }> };
    expect(payload.messages?.at(-1)).toEqual({ role: "user", content: "How do I reverse a list?" });
  });

  it("sends only one request for rapid Enter presses", async () => {
    render(<AssistantChat />);
    const input = await screen.findByPlaceholderText("Ask a study or project question…");
    fireEvent.change(input, { target: { value: "How do I deploy?" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    expect(await screen.findByText("Here is your answer.")).toBeTruthy();
    expect(mocks.fetchCalls.filter((call) => call.method === "POST")).toHaveLength(1);
  });

  it("resets the sending lock after a failed request", async () => {
    mocks.postStatus = 504;
    mocks.postBody = { code: "assistant-timeout", error: "The assistant took too long to respond. Please try again." };
    render(<AssistantChat />);
    const input = await screen.findByPlaceholderText("Ask a study or project question…");
    fireEvent.change(input, { target: { value: "first attempt" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
    await screen.findByRole("alert");

    fireEvent.change(input, { target: { value: "second attempt" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
    await screen.findAllByRole("alert");
    expect(mocks.fetchCalls.filter((call) => call.method === "POST")).toHaveLength(2);
  });

  it("shows the required disclosure points, the not-advice disclaimer, and an accessible Privacy notice link", async () => {
    render(<AssistantChat />);
    // Disclaimer (exact required sentence)
    expect(await screen.findByText("AI responses are informational and are not legal, medical, or financial advice.")).toBeTruthy();
    // Groq disclosure is intact
    expect(screen.getByText(/sent to Groq/)).toBeTruthy();
    expect(screen.getByText(/PulsePoint does not store your conversation/)).toBeTruthy();
    expect(screen.getByText(/AI responses may be inaccurate/)).toBeTruthy();
    // Accessible link to the privacy notice
    const legal = screen.getByRole("link", { name: "Privacy notice" });
    expect(legal).toBeTruthy();
    expect(legal.getAttribute("href")).toBe("/legal");
  });

  it("resets the sending lock after a successful request", async () => {
    render(<AssistantChat />);
    const input = await screen.findByPlaceholderText("Ask a study or project question…");
    fireEvent.change(input, { target: { value: "first question" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
    await screen.findByText("Here is your answer.");

    fireEvent.change(input, { target: { value: "second question" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
    await screen.findAllByText("Here is your answer.");
    expect(mocks.fetchCalls.filter((call) => call.method === "POST")).toHaveLength(2);
  });
});
