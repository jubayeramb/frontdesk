import type { Channel } from "@/db/schema";
import type { AgentReply } from "@/lib/agent/replies";
import type { Owner } from "@/lib/ownership";

// One line of the chat as the widget shows it. Shared by the API and the widget.
export type ChatMessage = {
  id: string;
  // A person is staff replying from the inbox; a note is a linking or
  // ownership change, carried as a text reply.
  from: "visitor" | "agent" | "person" | "note";
  channel: Channel;
  reply: AgentReply;
  // The option a visitor's message picked, so the chips above it show the pick.
  choiceId?: string;
};

export type ChatTurnResponse = { conversationId: string; replies: AgentReply[] };
export type ChatTranscriptResponse = {
  conversationId: string | null;
  owner: Owner | null;
  // "WhatsApp •••• 4821" (or "WhatsApp" for a contact with no number) once
  // the conversation continued on WhatsApp.
  whatsapp: string | null;
  messages: ChatMessage[];
};

export const MAX_MESSAGE_LENGTH = 1000;
