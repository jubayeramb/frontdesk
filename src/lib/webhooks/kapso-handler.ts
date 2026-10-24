import { z } from "zod";

import type { Db } from "@/db/client";
import type { WebhookEvent } from "@/db/schema";
import type { NamedModel } from "@/lib/agent/model";
import { runTurn } from "@/lib/agent/run-turn";
import { deliverTurn } from "@/lib/channels/deliver";
import type { ChannelAdapter } from "@/lib/channels/types";
import { kapsoMessageSchema, mapInbound } from "@/lib/channels/whatsapp/inbound";
import {
  findByExternalId,
  findOrCreateConversation,
  lastChoices,
  markFailed,
  noteWhatsAppInbound,
} from "@/lib/conversations/store";
import type { EventHandler } from "./events";

const receivedSchema = z.object({
  message: kapsoMessageSchema.extend({ from: z.string() }),
  conversation: z.object({ id: z.string().optional(), contact_name: z.string().nullish() }).optional(),
});

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

// What each stored Kapso event does. Events this change does not act on yet
// (sent, delivered, read, conversation events) are marked done untouched.
export function createKapsoHandler(deps: {
  db: Db;
  adapter: ChannelAdapter;
  models: NamedModel[];
  now?: () => Date;
}): EventHandler {
  const now = deps.now ?? (() => new Date());

  async function received(event: WebhookEvent) {
    const { message, conversation: kapso } = receivedSchema.parse(event.payload);
    // A retry after the turn already stored this message must not answer twice.
    if (await findByExternalId(deps.db, message.id)) return;

    const customer = message.from.replace(/\D/g, "");
    const conversation = await findOrCreateConversation(deps.db, {
      channel: "whatsapp",
      externalId: customer,
      displayName: kapso?.contact_name ?? undefined,
    });
    const sentAt = message.timestamp ? new Date(Number(message.timestamp) * 1000) : now();
    await noteWhatsAppInbound(deps.db, conversation.id, { kapsoConversationId: kapso?.id, at: sentAt });

    const inbound = mapInbound(message, await lastChoices(deps.db, conversation.id));
    // Images, reactions and the like stay in the event log; the agent skips them for now.
    if (!inbound) return;

    // Started with the turn, so the round trip to Kapso never adds to the reply time.
    const typing = deps.adapter.showTyping?.(message.id);
    const turn = await runTurn({
      db: deps.db,
      conversationId: conversation.id,
      channel: "whatsapp",
      inbound: { ...inbound, externalId: message.id },
      now: now(),
      models: deps.models,
    });
    await typing;
    await deliverTurn(deps.db, deps.adapter, { conversationId: conversation.id, to: customer, turn });
  }

  async function failed(event: WebhookEvent) {
    const { message } = failedSchema.parse(event.payload);
    const failure = message.kapso?.statuses?.findLast((s) => s.status === "failed")?.errors?.[0];
    const reason = failure ? `${String(failure.code)}: ${failure.title ?? "delivery failed"}` : "delivery failed";
    await markFailed(deps.db, { externalId: message.id }, reason);
  }

  return async (event) => {
    if (event.eventType === "whatsapp.message.received") return received(event);
    if (event.eventType === "whatsapp.message.failed") return failed(event);
  };
}
