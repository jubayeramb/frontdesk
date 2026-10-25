import { z } from "zod";

import type { Db } from "@/db/client";
import type { WebhookEvent } from "@/db/schema";
import type { NamedModel } from "@/lib/agent/model";
import { runTurn, type Inbound } from "@/lib/agent/run-turn";
import { deliverTurn } from "@/lib/channels/deliver";
import type { ChannelAdapter } from "@/lib/channels/types";
import { kapsoMessageSchema, mapInbound } from "@/lib/channels/whatsapp/inbound";
import {
  appendMessage,
  findByExternalId,
  findConversation,
  hasSendInFlight,
  findOrCreateConversation,
  lastChoices,
  markFailed,
  noteWhatsAppInbound,
} from "@/lib/conversations/store";
import { findCode, linkWhatsApp } from "@/lib/linking";
import { transition } from "@/lib/ownership";
import type { EventHandler } from "./events";
import type { KapsoEvent } from "./normalize";

const receivedSchema = z.object({
  message: kapsoMessageSchema.extend({ from: z.string() }),
  conversation: z.object({ id: z.string().optional(), contact_name: z.string().nullish() }).optional(),
});

const sentSchema = z.object({
  message: z.object({
    id: z.string(),
    to: z.string(),
    type: z.string(),
    text: z.object({ body: z.string() }).optional(),
    kapso: z.object({ direction: z.string().optional(), content: z.string().optional() }).optional(),
  }),
  conversation: z.object({ contact_name: z.string().nullish() }).optional(),
});

const endedSchema = z.object({ conversation: z.object({ phone_number: z.string() }) });

// An unknown outbound message within this long of an agent send that has no id
// yet may be that send's echo, so it is checked again.
const ECHO_WINDOW_MS = 30_000;
const ECHO_CHECKS = 3;

const failedSchema = z.object({
  message: z.object({
    id: z.string(),
    kapso: z
      .object({
        statuses: z
          .array(z.object({ status: z.string(), errors: z.array(z.object({ code: z.unknown(), title: z.string().optional() })).optional() }))
          .optional(),
      })
      .optional(),
  }),
});

// Shows WhatsApp's typing indicator for a message the agent will answer. Runs
// as soon as the webhook is stored, before the claim and the conversation
// lookups, which take seconds from far away; the turn itself comes later.
// Images and other messages the agent skips get no indicator.
export function createKapsoAcknowledger(deps: { db: Db; adapter: ChannelAdapter }) {
  return async (event: KapsoEvent): Promise<void> => {
    if (event.type !== "whatsapp.message.received" || !deps.adapter.markRead) return;
    const parsed = receivedSchema.safeParse(event.payload);
    if (!parsed.success || !mapInbound(parsed.data.message, null)) return;
    // The message is read either way; only the agent says it is typing.
    const conversation = await findConversation(deps.db, { channel: "whatsapp", externalId: event.partitionKey });
    await deps.adapter.markRead(parsed.data.message.id, { typing: conversation?.owner !== "human" });
  };
}

// What each stored Kapso event does. Delivered, read and created events are
// marked done untouched.
export function createKapsoHandler(deps: {
  db: Db;
  adapter: ChannelAdapter;
  models: NamedModel[];
  now?: () => Date;
  // How long an unknown echo waits before it is checked again.
  echoWaitMs?: number;
}): EventHandler {
  const now = deps.now ?? (() => new Date());

  async function received(event: WebhookEvent) {
    const { message, conversation: kapso } = receivedSchema.parse(event.payload);
    // A retry after the turn already stored this message must not answer twice.
    if (await findByExternalId(deps.db, message.id)) return;

    const customer = message.from.replace(/\D/g, "");
    const displayName = kapso?.contact_name ?? undefined;
    // A link code first moves the number onto the web conversation, so the
    // lookup below finds that one.
    const code = findCode(mapInbound(message, null)?.text ?? "");
    let link: Inbound["link"];
    if (code) {
      const result = await linkWhatsApp(deps.db, { code, whatsappNumber: customer, displayName, now: now() });
      link = result.linked ? "continued" : "rejected";
    }
    const conversation = await findOrCreateConversation(deps.db, { channel: "whatsapp", externalId: customer, displayName });
    const sentAt = message.timestamp ? new Date(Number(message.timestamp) * 1000) : now();
    await noteWhatsAppInbound(deps.db, conversation.id, { kapsoConversationId: kapso?.id, at: sentAt });

    const inbound = mapInbound(message, await lastChoices(deps.db, conversation.id));
    // Images, reactions and the like stay in the event log; the agent skips them for now.
    if (!inbound) return;

    const turn = await runTurn({
      db: deps.db,
      conversationId: conversation.id,
      channel: "whatsapp",
      inbound: { ...inbound, externalId: message.id, link },
      now: now(),
      models: deps.models,
    });
    await deliverTurn(deps.db, deps.adapter, { conversationId: conversation.id, to: customer, turn });
  }

  // Kapso reports every outbound message, ours and the inbox's alike, with no
  // field telling them apart, so the message id decides: one we stored is
  // ours, and one we never sent is a person replying from the inbox.
  async function sent(event: WebhookEvent) {
    const { message, conversation: kapso } = sentSchema.parse(event.payload);
    if (message.kapso?.direction && message.kapso.direction !== "outbound") return;
    if (await findByExternalId(deps.db, message.id)) return;

    const customer = message.to.replace(/\D/g, "");
    const conversation = await findOrCreateConversation(deps.db, {
      channel: "whatsapp",
      externalId: customer,
      displayName: kapso?.contact_name ?? undefined,
    });
    const since = new Date(now().getTime() - ECHO_WINDOW_MS);
    if (event.attempts <= ECHO_CHECKS && (await hasSendInFlight(deps.db, conversation.id, since))) {
      return { deferMs: deps.echoWaitMs ?? 5_000 };
    }

    // The takeover goes first: its note then reads before the reply, and a
    // retry after a failed insert still finds no stored id and finishes.
    await transition(deps.db, { conversationId: conversation.id, event: "human_replied" });
    await appendMessage(deps.db, {
      conversationId: conversation.id,
      channel: "whatsapp",
      direction: "outbound",
      sentBy: "human",
      body: message.text?.body ?? message.kapso?.content ?? `[${message.type}]`,
      externalId: message.id,
      deliveryStatus: "sent",
    });
  }

  // Kapso ends a conversation from the inbox or after 24 hours of quiet; either
  // way the customer's next message goes to the agent.
  async function ended(event: WebhookEvent) {
    const { conversation: kapso } = endedSchema.parse(event.payload);
    const conversation = await findConversation(deps.db, { channel: "whatsapp", externalId: kapso.phone_number.replace(/\D/g, "") });
    if (conversation) await transition(deps.db, { conversationId: conversation.id, event: "conversation_ended" });
  }

  async function failed(event: WebhookEvent) {
    const { message } = failedSchema.parse(event.payload);
    const failure = message.kapso?.statuses?.findLast((s) => s.status === "failed")?.errors?.[0];
    const reason = failure ? `${String(failure.code)}: ${failure.title ?? "delivery failed"}` : "delivery failed";
    await markFailed(deps.db, { externalId: message.id }, reason);
  }

  return async (event) => {
    if (event.eventType === "whatsapp.message.received") return received(event);
    if (event.eventType === "whatsapp.message.sent") return sent(event);
    if (event.eventType === "whatsapp.conversation.ended") return ended(event);
    if (event.eventType === "whatsapp.message.failed") return failed(event);
  };
}
