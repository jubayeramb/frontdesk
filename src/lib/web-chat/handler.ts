import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { Db } from "@/db/client";
import type { Message } from "@/db/schema";
import type { NamedModel } from "@/lib/agent/model";
import type { AgentReply } from "@/lib/agent/replies";
import { runTurn } from "@/lib/agent/run-turn";
import { deliverTurn } from "@/lib/channels/deliver";
import { webAdapter } from "@/lib/channels/web";
import {
  deleteMessage,
  findByNonce,
  findOrCreateConversation,
  getConversation,
  lastChoices,
  loadWindow,
  repliesTo,
} from "@/lib/conversations/store";
import { sweep, type EventHandler } from "@/lib/webhooks/events";
import { CHAT_COOKIE, CHAT_COOKIE_MAX_AGE_S, signConversationCookie, verifyConversationCookie } from "./cookie";
import { MAX_MESSAGE_LENGTH, type ChatMessage, type ChatTranscriptResponse, type ChatTurnResponse } from "./types";

export type ChatDeps = {
  db: Db;
  secret: string;
  models: NamedModel[];
  // Webhook events left behind by a dead worker are swept after each chat
  // request too, so WhatsApp does not depend on its own traffic to recover.
  handleWebhookEvent: EventHandler;
  // Runs work after the response is sent (`after` in the route).
  schedule: (work: () => Promise<void>) => void;
  now?: () => Date;
  // How long a duplicate request waits for the first one's replies.
  waitForTurnMs?: number;
};

// A turn older than this with no replies died with its worker (the route's
// maxDuration is 60 seconds), so a resubmission runs it again.
const DEAD_TURN_MS = 75_000;
const TRANSCRIPT_LIMIT = 100;

const turnRequest = z
  .object({
    text: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH).optional(),
    choiceId: z.string().min(1).max(100).optional(),
    nonce: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  })
  .refine((body) => body.text !== undefined || body.choiceId !== undefined, "Send text or a choice.");

export async function postChat(request: Request, deps: ChatDeps): Promise<Response> {
  let body: z.infer<typeof turnRequest>;
  try {
    body = turnRequest.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }

  const { db } = deps;
  const known = await conversationFromCookie(request, deps);
  const conversation = known ?? (await findOrCreateConversation(db, { channel: "web", externalId: randomUUID() }));
  const cookie = setCookie(signConversationCookie(conversation.id, deps.secret));

  // A tap names an option; it counts only if it was offered last, so a client
  // cannot put words in the agent's history.
  const option = body.choiceId
    ? (await lastChoices(db, conversation.id))?.find((o) => o.id === body.choiceId)
    : undefined;
  const text = option?.label ?? body.text;
  if (!text) return Response.json({ error: "unknown choice" }, { status: 400, headers: cookie });

  deps.schedule(async () => {
    try {
      await sweep(db, deps.handleWebhookEvent);
    } catch (error) {
      console.error(`webhook sweep after chat failed: ${error instanceof Error ? error.name : typeof error}`);
    }
  });

  const replies = await answerOnce(deps, conversation.id, { text, choiceId: option?.id, clientNonce: body.nonce });
  if (!replies) return Response.json({ error: "still working" }, { status: 409, headers: cookie });
  return Response.json({ conversationId: conversation.id, replies } satisfies ChatTurnResponse, { headers: cookie });
}

export async function getChat(request: Request, deps: Pick<ChatDeps, "db" | "secret">): Promise<Response> {
  const conversation = await conversationFromCookie(request, deps);
  if (!conversation) {
    return Response.json({ conversationId: null, messages: [] } satisfies ChatTranscriptResponse);
  }
  const history = await loadWindow(deps.db, conversation.id, TRANSCRIPT_LIMIT);
  return Response.json({
    conversationId: conversation.id,
    messages: history.flatMap(toChatMessage),
  } satisfies ChatTranscriptResponse);
}

// Runs the turn for a nonce the first time, and returns the stored replies
// every time after. Null when the first request is still working on it.
async function answerOnce(
  deps: ChatDeps,
  conversationId: string,
  inbound: { text: string; choiceId?: string; clientNonce: string },
): Promise<AgentReply[] | null> {
  const { db } = deps;
  const now = deps.now ?? (() => new Date());

  const existing = await findByNonce(db, conversationId, inbound.clientNonce);
  if (existing) {
    const stored = await waitForReplies(deps, existing);
    if (stored) return stored;
    if (now().getTime() - existing.createdAt.getTime() < DEAD_TURN_MS) return null;
    await deleteMessage(db, existing.id);
  }

  try {
    const turn = await runTurn({ db, conversationId, channel: "web", inbound, now: now(), models: deps.models });
    await deliverTurn(db, webAdapter, { conversationId, to: conversationId, turn });
    return turn.replies;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Another request with this nonce got in first.
    const first = await findByNonce(db, conversationId, inbound.clientNonce);
    return first ? waitForReplies(deps, first) : null;
  }
}

async function waitForReplies(deps: ChatDeps, inbound: Message): Promise<AgentReply[] | null> {
  const deadline = Date.now() + (deps.waitForTurnMs ?? 20_000);
  for (;;) {
    const replies = await repliesTo(deps.db, inbound);
    if (replies.length > 0) return replies.map(asReply);
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function conversationFromCookie(request: Request, deps: Pick<ChatDeps, "db" | "secret">) {
  const id = verifyConversationCookie(readCookie(request, CHAT_COOKIE), deps.secret);
  return id ? getConversation(deps.db, id) : undefined;
}

function toChatMessage(message: Message): ChatMessage[] {
  if (message.sentBy === "system" || message.payload?.continues) return [];
  if (message.direction === "inbound") {
    const choiceId = message.payload?.choiceId;
    return [
      {
        id: String(message.id),
        from: "visitor",
        reply: { kind: "text", text: message.body },
        ...(typeof choiceId === "string" ? { choiceId } : {}),
      },
    ];
  }
  return [{ id: String(message.id), from: "agent", reply: asReply(message) }];
}

// A stored agent reply keeps its kind in the payload; anything else is text.
function asReply(message: Message): AgentReply {
  const kind = message.payload?.kind;
  if (kind === "text" || kind === "choices" || kind === "handoff" || kind === "link") {
    return message.payload as AgentReply;
  }
  return { kind: "text", text: message.body };
}

function readCookie(request: Request, name: string): string | undefined {
  for (const part of request.headers.get("cookie")?.split(";") ?? []) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

// Refreshed on every message, so the cookie lasts as long as the conversation is kept.
function setCookie(value: string): HeadersInit {
  return {
    "set-cookie": `${CHAT_COOKIE}=${value}; Path=/; Max-Age=${CHAT_COOKIE_MAX_AGE_S}; HttpOnly; Secure; SameSite=Lax`,
  };
}

function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error; e instanceof Error; e = e.cause) {
    if ((e as { code?: unknown }).code === "23505") return true;
  }
  return false;
}
