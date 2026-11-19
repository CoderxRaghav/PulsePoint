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

import { AssistantWidget } from "@/components/assistant/assistant-widget";

const FAQ = "What is PulsePoint?";

function openWidget() {
  fireEvent.click(screen.getByRole("button", { name: "Ask AI — open PulsePoint AI assistant" }));
}

describe("AssistantWidget — floating button & panel", () => {
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

  it("renders the floating button with an accessible label before any panel opens", () => {
    render(<AssistantWidget />);
    const toggle = screen.getByRole("button", { name: "Ask AI — open PulsePoint AI assistant" });
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the disclosure with Groq details, the not-advice disclaimer, and an accessible Privacy notice link", async () => {
    render(<AssistantWidget />);
    openWidget();
    expect(await screen.findByRole("dialog", { name: "PulsePoint AI assistant" })).toBeTruthy();
    // Groq + context disclosure intact
    expect(screen.getByText(/processed by Groq/)).toBeTruthy();
    // Required exact disclaimer sentence
    expect(screen.getByText(/AI responses are informational and are not legal, medical, or financial advice\./)).toBeTruthy();
    // Accessible link to the privacy notice
    const legal = screen.getByRole("link", { name: "Privacy notice" });
    expect(legal).toBeTruthy();
    expect(legal.getAttribute("href")).toBe("/legal");
  });

  it("opens the panel with welcome message and FAQ cards on click", async () => {
    render(<AssistantWidget />);
    openWidget();
    expect(await screen.findByRole("dialog", { name: "PulsePoint AI assistant" })).toBeTruthy();
    expect(screen.getByText(/Hey there!/)).toBeTruthy();
    expect(screen.getByRole("button", { name: FAQ })).toBeTruthy();
    expect(screen.getByText("Have another question? Feel free to ask!")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close assistant" })).toBeTruthy();
  });

  it("closes via the close button and returns focus to the toggle", async () => {
    render(<AssistantWidget />);
    openWidget();
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Close assistant" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ask AI — open PulsePoint AI assistant" }));
  });

  it("closes on Escape and via outside pointer down", async () => {
    render(<AssistantWidget />);
    openWidget();
    await screen.findByRole("dialog");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    openWidget();
    await screen.findByRole("dialog");
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("AssistantWidget — chat behavior", () => {
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

  it("sends an FAQ question to the assistant API and renders the reply", async () => {
    render(<AssistantWidget />);
    openWidget();
    const faqButton = await screen.findByRole("button", { name: FAQ });
    fireEvent.click(faqButton);

    expect(await screen.findByText("Here is your answer.")).toBeTruthy();
    const posts = mocks.fetchCalls.filter((call) => call.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe("/api/ai/assistant");
    const payload = JSON.parse(posts[0].body ?? "{}") as { messages?: Array<{ role: string; content: string }>; uid?: string };
    expect(payload.uid).toBeUndefined();
    expect(payload.messages?.at(-1)).toEqual({ role: "user", content: FAQ });
  });

  it("sends a typed message on Enter and shows the assistant reply", async () => {
    render(<AssistantWidget />);
    openWidget();
    const input = await screen.findByPlaceholderText("Ask me anything...");
    fireEvent.change(input, { target: { value: "How do I deploy?" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    expect(await screen.findByText("Here is your answer.")).toBeTruthy();
    expect(screen.getByText("How do I deploy?")).toBeTruthy();
    const posts = mocks.fetchCalls.filter((call) => call.method === "POST");
    expect(posts).toHaveLength(1);
  });

  it("does not send on Shift+Enter (newline)", async () => {
    render(<AssistantWidget />);
    openWidget();
    const input = await screen.findByPlaceholderText("Ask me anything...");
    fireEvent.change(input, { target: { value: "line one" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(mocks.fetchCalls.filter((call) => call.method === "POST")).toHaveLength(0);
  });

  it("shows a friendly error when the assistant API fails (503)", async () => {
    mocks.postStatus = 503;
    mocks.postBody = { code: "assistant-unavailable", error: "The assistant is temporarily unavailable. Please try again later." };
    render(<AssistantWidget />);
    openWidget();
    const faqButton = await screen.findByRole("button", { name: FAQ });
    fireEvent.click(faqButton);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("temporarily unavailable");
  });

  it("starts a new chat and clears the conversation", async () => {
    render(<AssistantWidget />);
    openWidget();
    const faqButton = await screen.findByRole("button", { name: FAQ });
    fireEvent.click(faqButton);
    await screen.findByText("Here is your answer.");

    fireEvent.click(screen.getByRole("button", { name: "Start a new chat" }));
    expect(screen.queryByText("Here is your answer.")).toBeNull();
    expect(screen.getByRole("button", { name: FAQ })).toBeTruthy();
  });

  it("sends only one request for rapid repeated submissions", async () => {
    render(<AssistantWidget />);
    openWidget();
    const faqButton = await screen.findByRole("button", { name: FAQ });
    fireEvent.click(faqButton);
    fireEvent.click(faqButton);
    fireEvent.click(faqButton);

    expect(await screen.findByText("Here is your answer.")).toBeTruthy();
    expect(mocks.fetchCalls.filter((call) => call.method === "POST")).toHaveLength(1);
  });

  it("sends only one request for rapid Enter presses", async () => {
    render(<AssistantWidget />);
    openWidget();
    const input = await screen.findByPlaceholderText("Ask me anything...");
    fireEvent.change(input, { target: { value: "How do I deploy?" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    expect(await screen.findByText("Here is your answer.")).toBeTruthy();
    expect(mocks.fetchCalls.filter((call) => call.method === "POST")).toHaveLength(1);
  });

  it("resets the sending lock after a successful request", async () => {
    render(<AssistantWidget />);
    openWidget();
    const faqButton = await screen.findByRole("button", { name: FAQ });
    fireEvent.click(faqButton);
    await screen.findByText("Here is your answer.");

    // FAQ grid is replaced by the conversation once a message exists, so the
    // second submission goes through the composer.
    const input = await screen.findByPlaceholderText("Ask me anything...");
    fireEvent.change(input, { target: { value: "second question" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
    await screen.findAllByText("Here is your answer.");
    expect(mocks.fetchCalls.filter((call) => call.method === "POST")).toHaveLength(2);
  });

  it("resets the sending lock after a failed request", async () => {
    mocks.postStatus = 503;
    mocks.postBody = { code: "assistant-unavailable", error: "The assistant is temporarily unavailable. Please try again later." };
    render(<AssistantWidget />);
    openWidget();
    const faqButton = await screen.findByRole("button", { name: FAQ });
    fireEvent.click(faqButton);
    await screen.findByRole("alert");

    const input = await screen.findByPlaceholderText("Ask me anything...");
    fireEvent.change(input, { target: { value: "try again" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
    await screen.findByRole("alert");
    expect(mocks.fetchCalls.filter((call) => call.method === "POST")).toHaveLength(2);
  });
});

describe("AssistantWidget — unavailable & signed-out states", () => {
  beforeEach(() => {
    mocks.enabled = true;
    mocks.postStatus = 200;
    mocks.postBody = { message: { role: "assistant", content: "unused" } };
    mocks.fetchCalls.length = 0;
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the disabled state instead of a fake chat when the assistant is off", async () => {
    mocks.authUser = { getIdToken: async () => "test-id-token" };
    mocks.enabled = false;
    render(<AssistantWidget />);
    openWidget();
    expect(await screen.findByText("Assistant unavailable")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Ask me anything...")).toBeNull();
    expect(screen.queryByRole("button", { name: FAQ })).toBeNull();
    expect(screen.getByText("Unavailable")).toBeTruthy();
  });

  it("prompts sign-in instead of chatting when signed out, and never calls the API", async () => {
    mocks.authUser = null;
    render(<AssistantWidget />);
    openWidget();
    expect(await screen.findByText("Sign in to chat")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Ask me anything...")).toBeNull();
    expect(mocks.fetchCalls.filter((call) => call.method === "POST")).toHaveLength(0);
  });
});
