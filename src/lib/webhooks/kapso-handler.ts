import { z } from "zod";

import type { Db } from "@/db/client";
import type { Message, WebhookEvent } from "@/db/schema";
import type { NamedModel } from "@/lib/agent/model";
import type { AgentReply } from "@/lib/agent/replies";
import { runTurn, type Inbound } from "@/lib/agent/run-turn";
import { deliverTurn } from "@/lib/channels/deliver";
import type { ChannelAdapter } from "@/lib/channels/types";
import { classifyInbound, kapsoMessageSchema, mapInbound } from "@/lib/channels/whatsapp/inbound";
import {
  appendMessage,
  findByExternalId,
  findConversation,
  hasSendInFlight,
  findOrCreateConversation,
  getConversation,
  lastChoices,
  markFailed,
  noteWhatsAppInbound,
  repliesTo,
} from "@/lib/conversations/store";
import type { Limits } from "@/lib/guards";
import { findCode, linkWhatsApp } from "@/lib/linking";
import { transition } from "@/lib/ownership";
import type { EventHandler } from "./events";
import { customerAddress, customerIds, customerOf, type KapsoEvent } from "./normalize";

// Kapso sends a profile name when Meta has one; a customer known by user id
// may only have a username.
const contactSchema = z.object({ contact_name: z.string().nullish(), username: z.string().nullish() });

const receivedSchema = z.object({
  message: kapsoMessageSchema,
  conversation: contactSchema.extend({ id: z.string().optional() }).optional(),
});

const sentSchema = z.object({
  message: z.object({
    id: z.string(),
    type: z.string(),
    text: z.object({ body: z.string() }).optional(),
    kapso: z.object({ direction: z.string().optional(), content: z.string().optional() }).optional(),
  }),
  conversation: contactSchema.optional(),
});

function nameOf(conversation: z.infer<typeof contactSchema> | undefined): string | undefined {
  return conversation?.contact_name ?? conversation?.username ?? undefined;
}

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
// Reactions get no receipt, and images get one without the indicator, since
// their reply is fixed.
export function createKapsoAcknowledger(deps: { db: Db; adapter: ChannelAdapter }) {
  return async (event: KapsoEvent): Promise<void> => {
    if (event.type !== "whatsapp.message.received" || !deps.adapter.markRead) return;
    const parsed = receivedSchema.safeParse(event.payload);
    if (!parsed.success) return;
    const kind = classifyInbound(parsed.data.message);
    if (kind === "silent") return;
    // The message is read either way; only the agent says it is typing.
    const conversation = await findConversation(deps.db, { channel: "whatsapp", externalId: customerIds(customerOf(event.payload)) });
    await deps.adapter.markRead(parsed.data.message.id, { typing: kind === "message" && conversation?.owner !== "human" });
  };
}

// What each stored Kapso event does. Delivered, read and created events are
// marked done untouched.
export function createKapsoHandler(deps: {
  db: Db;
  adapter: ChannelAdapter;
  models: NamedModel[];
  limits?: Limits;
  now?: () => Date;
  // How long an unknown echo waits before it is checked again.
  echoWaitMs?: number;
}): EventHandler {
  const now = deps.now ?? (() => new Date());

  async function received(event: WebhookEvent) {
    const { message, conversation: kapso } = receivedSchema.parse(event.payload);
    const customer = customerOf(event.payload);
    const [id, ...otherIds] = customerIds(customer);
    const to = customerAddress(customer);
    // A retry finishes what an earlier attempt started, and never answers twice.
    const stored = await findByExternalId(deps.db, message.id);
    if (stored) return resume(stored, to);

    const displayName = nameOf(kapso);
    // A link code first moves the customer onto the web conversation, so the
    // lookup below finds that one.
    const code = findCode(mapInbound(message, null)?.text ?? "");
    let link: Inbound["link"];
    if (code) {
      const result = await linkWhatsApp(deps.db, { code, whatsappId: id!, displayName, now: now() });
      link = result.linked ? "continued" : "rejected";
    }
    const conversation = await findOrCreateConversation(deps.db, { channel: "whatsapp", externalId: id!, otherIds, displayName });
    const sentAt = message.timestamp ? new Date(Number(message.timestamp) * 1000) : now();
    await noteWhatsAppInbound(deps.db, conversation.id, { kapsoConversationId: kapso?.id, at: sentAt });

    // Reactions stay in the event log only. An image is stored by its type and
    // gets the fixed text-only reply.
    const kind = classifyInbound(message);
    if (kind === "silent") return;
    const inbound =
      kind === "unsupported"
        ? { text: `[${message.type}]`, unsupported: message.type }
        : mapInbound(message, await lastChoices(deps.db, conversation.id));
    if (!inbound) return;

    const turn = await runTurn({
      db: deps.db,
      conversationId: conversation.id,
      channel: "whatsapp",
      inbound: { ...inbound, externalId: message.id, link },
      now: now(),
      models: deps.models,
      limits: deps.limits,
    });
    await deliverTurn(deps.db, deps.adapter, { conversationId: conversation.id, to, turn, now: now() });
  }

  // What follows the stored message says how far the first attempt got: no
  // reply means the turn died before storing one, so it runs now for the
  // stored message; replies never attempted are sent; anything else finished.
  // The customer's later events wait behind this one, so none can follow yet.
  async function resume(inbound: Message, to: string) {
    const after = await repliesTo(deps.db, inbound);
    if (after.length > 0) {
      const unsent = after.filter((m) => m.sentBy === "ai" && m.deliveryStatus === null && !m.payload?.continues);
      if (unsent.length === 0) return;
      const turn = { replies: unsent.map((m) => m.payload as AgentReply), messageIds: unsent.map((m) => m.id) };
      await deliverTurn(deps.db, deps.adapter, { conversationId: inbound.conversationId, to, turn, now: now() });
      return;
    }
    if (!(await getConversation(deps.db, inbound.conversationId))) return;
    const unsupported = inbound.payload?.unsupported;
    const turn = await runTurn({
      db: deps.db,
      conversationId: inbound.conversationId,
      channel: "whatsapp",
      inbound: { text: inbound.body, ...(typeof unsupported === "string" ? { unsupported } : {}) },
      storedInbound: inbound,
      now: now(),
      models: deps.models,
      limits: deps.limits,
    });
    await deliverTurn(deps.db, deps.adapter, { conversationId: inbound.conversationId, to, turn, now: now() });
  }

  // Kapso reports every outbound message, ours and the inbox's alike, with no
  // field telling them apart, so the message id decides: one we stored is
  // ours, and one we never sent is a person replying from the inbox.
  async function sent(event: WebhookEvent) {
    const { message, conversation: kapso } = sentSchema.parse(event.payload);
    if (message.kapso?.direction && message.kapso.direction !== "outbound") return;
    if (await findByExternalId(deps.db, message.id)) return;

    const [id, ...otherIds] = customerIds(customerOf(event.payload));
    const conversation = await findOrCreateConversation(deps.db, {
      channel: "whatsapp",
      externalId: id!,
      otherIds,
      displayName: nameOf(kapso),
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
    const conversation = await findConversation(deps.db, { channel: "whatsapp", externalId: customerIds(customerOf(event.payload)) });
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
