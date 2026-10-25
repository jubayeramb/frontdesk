import { generateText, isStepCount, type ModelMessage } from "ai";

import type { Db } from "@/db/client";
import type { Channel, Message } from "@/db/schema";
import { appendMessage, appendMessages, getConversation, loadWindow } from "@/lib/conversations/store";
import { firstMessage } from "./first-message";
import { dropListedOptions, dropOptionIds } from "./listed-options";
import { stripDateLists, asksForDeparture } from "./date-lists";
import { describeError, withFallback, type NamedModel } from "./model";
import { ensureQuoteTotal, guardPrices, inTaka } from "./price-guard";
import { buildSystemPrompt } from "./prompt";
import type { AgentReply, ChoiceOption } from "./replies";
import { createTurnTools, offerDepartures } from "./tools";

export const BUSY_REPLY = "We're busy right now. Try again in a minute.";
const MAX_STEPS = 5;

// A tap on a button or list row carries the option id; typed text does not.
// `externalId` is the channel's id for the message, when it has one, and
// `clientNonce` the sender's own, so a resubmission is stored once. `link` is
// set when the message carried a link code: whether it continued a web
// conversation or was expired or used.
export type Inbound = {
  text: string;
  choiceId?: string;
  externalId?: string;
  clientNonce?: string;
  link?: "continued" | "rejected";
};

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
  // Where a web visitor is sent to reach a person, digits only.
  whatsappNumber?: string;
  // Called once per answered turn; usage feeds limits and the write-up.
  onModelResult?: (info: { modelId: string; steps: number; inputTokens: number; outputTokens: number }) => void;
}): Promise<TurnResult> {
  const { db, conversationId, channel, inbound, now } = input;
  const conversation = await getConversation(db, conversationId);
  if (!conversation) throw new Error(`Unknown conversation ${conversationId}`);

  const inboundRow = await appendMessage(db, {
    conversationId,
    channel,
    direction: "inbound",
    sentBy: "customer",
    body: inbound.text,
    payload: inbound.choiceId ? { choiceId: inbound.choiceId } : inbound.link ? { link: inbound.link } : undefined,
    externalId: inbound.externalId,
    clientNonce: inbound.clientNonce,
  });
  // A person owns the conversation: the message is kept for them, and the
  // agent stays quiet.
  if (conversation.owner === "human") return { replies: [], messageIds: [] };

  const history = await loadWindow(db, conversationId);
  const { tools, record } = createTurnTools({ db, conversationId, now, channel, whatsappNumber: input.whatsappNumber });
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
    let text = inTaka(dropOptionIds(firstMessage(outcome.value.text.trim())));
    // A reply that asks for a departure but lists none this turn (dates copied
    // from an earlier message, or "which departure?" with nothing to pick) gets
    // the quoted tour's real departures.
    const quotedTour = record.quote?.tour.slug ?? conversation.state.quote?.tour.slug;
    if (record.choicesOf !== "departures" && !record.booked && quotedTour && asksForDeparture(text)) {
      try {
        await offerDepartures({ db, conversationId, now }, record, quotedTour);
      } catch (error) {
        console.error(`offering departures after the reply failed: ${describeError(error)}`);
      }
    }
    if (record.choicesOf === "departures") text = stripDateLists(text);
    const guarded = guardPrices({
      text: record.choices ? dropListedOptions(text, record.choices.options) : text,
      allowed: record.amounts,
      state: conversation.state,
      turnQuote: record.quote,
    });
    if (guarded.replaced) console.warn(`price guard replaced a reply from ${outcome.modelId}`);
    // A booking confirmation speaks for itself; a fresh quote must show its total.
    const reply = record.booked ? guarded.text : ensureQuoteTotal(guarded.text, record.quote);
    replies = [];
    if (record.handoff) {
      // One handoff message, whatever else the model wrote.
      replies.push(record.handoff);
    } else {
      if (reply) replies.push({ kind: "text", text: reply });
      if (record.choices) replies.push(record.choices);
    }
    if (replies.length === 0) {
      replies.push({ kind: "text", text: "Sorry, I didn't get that. Which tour are you interested in?" });
    }
  }

  // A person may have taken over while the model was working; their reply wins.
  // The turn's own handoff made the owner human; that reply still goes out.
  const takenOver = !record.handoff && (await getConversation(db, conversationId))?.owner === "human";
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
      ...(takenOver ? { deliveryStatus: "suppressed" as const } : {}),
    })),
  );
  if (takenOver) {
    console.info(`turn after message ${inboundRow.id} suppressed: a person took over`);
    return { replies: [], messageIds: [] };
  }
  return { replies, messageIds: stored.map((m) => m.id) };
}

const LINK_MEANING = {
  continued: "I'm continuing my website chat here on WhatsApp.",
  rejected: "I have a code from the website chat, but it has expired or was already used.",
};

// History as the model sees it. Offered options and picked ids are spelled
// out so a later "the Sunday one" or a tapped button maps to a real id.
export function toModelMessages(history: Message[]): ModelMessage[] {
  const out: ModelMessage[] = [];
  for (const message of history) {
    // A long reply split for a channel is already in history as one message.
    if (message.sentBy === "system" || message.payload?.continues) continue;
    if (message.sentBy === "customer") {
      // The model never sees a link code, only what it meant.
      const link = message.payload?.link;
      if (link) {
        out.push({ role: "user", content: LINK_MEANING[link === "continued" ? "continued" : "rejected"] });
        continue;
      }
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
