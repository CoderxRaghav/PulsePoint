import type { Metadata } from "next";
import { AssistantChat } from "@/components/assistant/assistant-chat";

export const metadata: Metadata = {
  title: "PulsePoint — AI Assistant",
  description:
    "Ask general study and project questions with a permission-aware PulsePoint assistant. AI-generated answers; verify important information.",
};

export default function AssistantPage() {
  return <AssistantChat />;
}
