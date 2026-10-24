import { generateText, isStepCount, type ModelMessage } from "ai";

import type { Db } from "@/db/client";
import type { Channel, Message } from "@/db/schema";
import { appendMessage, appendMessages, getConversation, loadWindow } from "@/lib/conversations/store";
import { firstMessage } from "./first-message";
import { describeError, withFallback, type NamedModel } from "./model";
import { guardPrices } from "./price-guard";
import { buildSystemPrompt } from "./prompt";
import type { AgentReply, ChoiceOption } from "./replies";
import { createTurnTools } from "./tools";

export const BUSY_REPLY = "We're busy right now. Try again in a minute.";
const MAX_STEPS = 5;

// A tap on a button or list row carries the option id; typed text does not.
// `externalId` is the channel's id for the message, when it has one, and
// `clientNonce` the sender's own, so a resubmission is stored once.
export type Inbound = { text: string; choiceId?: string; externalId?: string; clientNonce?: string };

export type TurnResult = {
  replies: AgentReply[];
  // The stored message for each reply, in the same order, for delivery.
  messageIds: number[];
};

// One customer message in, the agent's replies out. Knows nothing about how a
// channel delivers them; `channel` only picks a one-line hint in the prompt.
export async function runTurn(input: {
  db: Db;
  conversationId: string;
  channel: Channel;
  inbound: Inbound;
  now: Date;
  models: NamedModel[];
  // Called once per answered turn; usage feeds limits and the write-up.
  onModelResult?: (info: { modelId: string; steps: number; inputTokens: number; outputTokens: number }) => void;
}): Promise<TurnResult> {
  const { db, conversationId, channel, inbound, now } = input;
  const conversation = await getConversation(db, conversationId);
  if (!conversation) throw new Error(`Unknown conversation ${conversationId}`);

  await appendMessage(db, {
    conversationId,
    channel,
    direction: "inbound",
    sentBy: "customer",
    body: inbound.text,
    payload: inbound.choiceId ? { choiceId: inbound.choiceId } : undefined,
    externalId: inbound.externalId,
    clientNonce: inbound.clientNonce,
  });

  const history = await loadWindow(db, conversationId);
  const { tools, record } = createTurnTools({ db, conversationId, now });
  const system = buildSystemPrompt({ channel, state: conversation.state, now });

  const outcome = await withFallback(input.models, (model) =>
    generateText({
      model,
      system,
      messages: toModelMessages(history),
      tools,
      stopWhen: isStepCount(MAX_STEPS),
      maxRetries: 0, // withFallback switches models instead of waiting
    }),
  );

  let replies: AgentReply[];
  if (!outcome.ok) {
    console.error(`turn failed on every model: ${describeError(outcome.error)}`);
    replies = [{ kind: "text", text: BUSY_REPLY }];
  } else {
    input.onModelResult?.({
      modelId: outcome.modelId,
      steps: outcome.value.steps.length,
      inputTokens: outcome.value.totalUsage.inputTokens ?? 0,
      outputTokens: outcome.value.totalUsage.outputTokens ?? 0,
    });
    const guarded = guardPrices({
      text: firstMessage(outcome.value.text.trim()),
      allowed: record.amounts,
      state: conversation.state,
      turnQuote: record.quote,
    });
    if (guarded.replaced) console.warn(`price guard replaced a reply from ${outcome.modelId}`);
    replies = [];
    if (guarded.text) replies.push({ kind: "text", text: guarded.text });
    if (record.choices) replies.push(record.choices);
    if (replies.length === 0) {
      replies.push({ kind: "text", text: "Sorry, I didn't get that. Which tour are you interested in?" });
    }
  }

  const stored = await appendMessages(
    db,
    conversationId,
    replies.map((reply) => ({
      conversationId,
      channel,
      direction: "outbound" as const,
      sentBy: "ai" as const,
      body: reply.kind === "choices" ? reply.prompt : reply.text,
      payload: reply,
    })),
  );
  return { replies, messageIds: stored.map((m) => m.id) };
}

// History as the model sees it. Offered options and picked ids are spelled
// out so a later "the Sunday one" or a tapped button maps to a real id.
export function toModelMessages(history: Message[]): ModelMessage[] {
  const out: ModelMessage[] = [];
  for (const message of history) {
    // A long reply split for a channel is already in history as one message.
    if (message.sentBy === "system" || message.payload?.continues) continue;
    if (message.sentBy === "customer") {
      const choiceId = message.payload?.choiceId;
      out.push({
        role: "user",
        content: typeof choiceId === "string" ? `${message.body} (picked option id: ${choiceId})` : message.body,
      });
      continue;
    }
    const options = message.payload?.kind === "choices" ? (message.payload.options as ChoiceOption[]) : null;
    out.push({
      role: "assistant",
      content: options
        ? `${message.body}\nOptions: ${options.map((o) => `${o.label} (id: ${o.id})`).join("; ")}`
        : message.body,
    });
  }
  return out;
}
