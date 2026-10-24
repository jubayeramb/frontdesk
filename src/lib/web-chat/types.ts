import type { AgentReply } from "@/lib/agent/replies";

// One line of the chat as the widget shows it. Shared by the API and the widget.
export type ChatMessage = {
  id: string;
  from: "visitor" | "agent";
  reply: AgentReply;
  // The option a visitor's message picked, so the chips above it show the pick.
  choiceId?: string;
};

export type ChatTurnResponse = { conversationId: string; replies: AgentReply[] };
export type ChatTranscriptResponse = { conversationId: string | null; messages: ChatMessage[] };

export const MAX_MESSAGE_LENGTH = 1000;
