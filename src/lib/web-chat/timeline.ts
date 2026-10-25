import { and, eq } from "drizzle-orm";

import type { Db } from "@/db/client";
import { channelIdentities, type Channel, type Message } from "@/db/schema";
import type { AgentReply } from "@/lib/agent/replies";
import { getConversation, loadWindow } from "@/lib/conversations/store";
import type { Owner } from "@/lib/ownership";

const TIMELINE_LIMIT = 200;

export type TimelineEntry =
  | { id: number; at: Date; channel: Channel; from: "you" | "agent" | "person"; text: string; options?: string[] }
  // Who is answering changed, or the chat moved to WhatsApp.
  | { id: number; at: Date; channel: Channel; from: "note"; text: string };

export type Timeline = {
  owner: Owner;
  // "•••• 4821" once the conversation continued on WhatsApp.
  whatsapp: string | null;
  entries: TimelineEntry[];
};

// The visitor's own conversation across both channels, oldest first. Shows
// what was said and who said it; tool details, ids and links are left out.
export async function loadTimeline(db: Db, conversationId: string): Promise<Timeline | null> {
  const conversation = await getConversation(db, conversationId);
  if (!conversation) return null;
  const messages = await loadWindow(db, conversationId, TIMELINE_LIMIT);
  return {
    owner: conversation.owner,
    whatsapp: await maskedWhatsApp(db, conversation.contactId),
    entries: messages.flatMap(toEntry),
  };
}

// The contact's WhatsApp number as "•••• 4821", once they continued there.
export async function maskedWhatsApp(db: Db, contactId: string): Promise<string | null> {
  const [identity] = await db
    .select({ externalId: channelIdentities.externalId })
    .from(channelIdentities)
    .where(and(eq(channelIdentities.contactId, contactId), eq(channelIdentities.channel, "whatsapp")));
  return identity ? `•••• ${identity.externalId.slice(-4)}` : null;
}

// Replies that never went out, and the extra parts of a reply split for a
// channel, are not part of what the customer saw.
export function shownToCustomer(message: Message): boolean {
  return !message.payload?.continues && message.deliveryStatus !== "suppressed";
}

function toEntry(message: Message): TimelineEntry[] {
  const base = { id: message.id, at: message.createdAt, channel: message.channel };
  if (!shownToCustomer(message)) return [];
  if (message.sentBy === "system") {
    const note = noteText(message);
    return note ? [{ ...base, from: "note", text: note }] : [];
  }
  if (message.sentBy === "customer") return [{ ...base, from: "you", text: message.body }];
  if (message.sentBy === "human") return [{ ...base, from: "person", text: message.body }];
  const reply = message.payload as AgentReply | null;
  if (reply?.kind === "choices") {
    return [{ ...base, from: "agent", text: reply.prompt, options: reply.options.map((o) => o.label) }];
  }
  return [{ ...base, from: "agent", text: message.body }];
}

export function noteText(message: Message): string | null {
  const payload = message.payload ?? {};
  if (payload.kind === "linked") return "Continued on WhatsApp";
  if (payload.kind === "ownership") return payload.to === "human" ? "A person joined" : "The front desk agent is back";
  return null;
}
