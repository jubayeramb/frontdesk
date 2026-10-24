import { randomUUID } from "node:crypto";

import type { Db } from "@/db/client";
import type { TurnResult } from "@/lib/agent/run-turn";
import { appendMessage, markFailed, markSending, markSent } from "@/lib/conversations/store";
import type { ChannelAdapter, OutboundMessage } from "./types";

// Sends a turn's stored replies through a channel, one message at a time.
// Every send has a stored row first (pending, with our nonce) and ends with
// the channel's id or the error. A reply that renders into several messages
// gets one row per extra part, linked to the reply's row.
export async function deliverTurn(
  db: Db,
  adapter: ChannelAdapter,
  input: { conversationId: string; to: string; turn: TurnResult },
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  let stopped: string | null = null;

  for (const [index, reply] of input.turn.replies.entries()) {
    const replyId = input.turn.messageIds[index]!;
    if (stopped) {
      await markFailed(db, { id: replyId }, stopped);
      failed++;
      continue;
    }
    for (const [part, message] of adapter.render(reply).entries()) {
      const nonce = randomUUID();
      const id = part === 0 ? replyId : await storePart(db, adapter, input.conversationId, replyId, part, message, nonce);
      if (part === 0) await markSending(db, id, nonce);

      const result = await adapter.send(input.to, message, { nonce });
      if (result.ok) {
        await markSent(db, id, result.externalId);
        sent++;
        continue;
      }
      await markFailed(db, { id }, `${result.error.code}: ${result.error.message}`);
      console.error(`${adapter.channel} send failed for message ${id}: ${result.error.code}`);
      failed++;
      // Later replies would read wrong without this one, so they are not sent.
      stopped = "skipped: an earlier message in this turn failed";
      break;
    }
  }
  return { sent, failed };
}

async function storePart(
  db: Db,
  adapter: ChannelAdapter,
  conversationId: string,
  replyId: number,
  part: number,
  message: OutboundMessage,
  nonce: string,
): Promise<number> {
  const row = await appendMessage(db, {
    conversationId,
    channel: adapter.channel,
    direction: "outbound",
    sentBy: "ai",
    body: message.type === "text" ? message.text : message.body,
    payload: { continues: replyId, part },
    clientNonce: nonce,
    deliveryStatus: "pending",
  });
  return row.id;
}
