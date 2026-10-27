import { z } from "zod";

import type { ChoiceOption } from "@/lib/agent/replies";
import type { Inbound } from "@/lib/agent/run-turn";
import { isNumbered } from "./render";

// The parts of a Kapso v2 `message` this app reads.
export const kapsoMessageSchema = z.object({
  id: z.string(),
  type: z.string(),
  // Null for a customer Meta reports by user id only.
  from: z.string().nullish(),
  to: z.string().nullish(),
  timestamp: z.string().optional(),
  text: z.object({ body: z.string() }).optional(),
  interactive: z
    .object({
      type: z.string(),
      button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
      list_reply: z.object({ id: z.string(), title: z.string() }).optional(),
    })
    .optional(),
  context: z.object({ id: z.string() }).nullish(),
});

export type KapsoMessage = z.infer<typeof kapsoMessageSchema>;

// What a customer's WhatsApp message gets: a turn (`message`), nothing at all
// (`silent`), or the fixed text-only reply (`unsupported`).
export type InboundKind = "message" | "silent" | "unsupported";

// Reactions and WhatsApp's own system notices are not something to answer.
const SILENT_TYPES = new Set(["reaction", "system", "ephemeral", "request_welcome"]);

export function classifyInbound(message: KapsoMessage): InboundKind {
  if (message.interactive?.button_reply || message.interactive?.list_reply) return "message";
  if (message.type === "text") return message.text?.body.trim() ? "message" : "silent";
  if (SILENT_TYPES.has(message.type)) return "silent";
  // Images, audio, video, documents, stickers, locations, contact cards, and
  // anything WhatsApp itself marks unsupported.
  return "unsupported";
}

// Turns a customer's WhatsApp message into what the agent reads. `lastChoices`
// are the options of the latest choices reply in the conversation. Returns
// null for anything `classifyInbound` does not call a message.
export function mapInbound(message: KapsoMessage, lastChoices: ChoiceOption[] | null): Inbound | null {
  const tap = message.interactive?.button_reply ?? message.interactive?.list_reply;
  if (tap) {
    const option = lastChoices?.find((o) => o.id === tap.id);
    return { text: option?.label ?? tap.title, choiceId: tap.id };
  }

  const text = message.text?.body.trim();
  if (message.type !== "text" || !text) return null;

  const number = /^(\d{1,3})\.?$/.exec(text);
  if (number && lastChoices && isNumbered(lastChoices)) {
    const option = lastChoices[Number(number[1]) - 1];
    if (option) return { text: option.label, choiceId: option.id };
  }
  return { text };
}
