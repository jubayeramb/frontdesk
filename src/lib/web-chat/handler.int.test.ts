import { randomUUID } from "node:crypto";

import { asc, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { messages, webhookEvents, type WebhookEvent } from "@/db/schema";
import { seed } from "@/db/seed-data";
import { setupTestDb } from "../../../test/int/db";
import { scriptedModel, type ScriptStep } from "../../../test/support/scripted-model";
import { CHAT_COOKIE, signConversationCookie } from "./cookie";
import { getChat, postChat } from "./handler";
import type { ChatTranscriptResponse, ChatTurnResponse } from "./types";

const db = setupTestDb();
const SECRET = "c".repeat(32);
// Monday 2 November 2026, 10:00 in Dhaka.
const now = new Date("2026-11-02T10:00:00+06:00");

function setup(script: ScriptStep[] = [{ text: "Hi! Which tour are you interested in?" }]) {
  const model = scriptedModel(script);
  const scheduled: (() => Promise<void>)[] = [];
  const handled: WebhookEvent[] = [];
  const deps = {
    db,
    secret: SECRET,
    models: [{ id: "primary", model }],
    handleWebhookEvent: async (event: WebhookEvent) => void handled.push(event),
    schedule: (work: () => Promise<void>) => void scheduled.push(work),
    now: () => now,
    waitForTurnMs: 2_000,
  };
  return {
    model,
    handled,
    post: (body: Record<string, unknown>, cookie?: string) =>
      postChat(
        new Request("http://localhost/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
          body: JSON.stringify(body),
        }),
        deps,
      ),
    get: (cookie?: string) => getChat(new Request("http://localhost/api/chat", { headers: cookie ? { cookie } : {} }), deps),
    runScheduled: async () => {
      for (const work of scheduled.splice(0)) await work();
    },
  };
}

// The cookie a browser would send back after this response.
function cookieFrom(response: Response): string {
  const header = response.headers.get("set-cookie") ?? "";
  expect(header).toMatch(/HttpOnly; Secure; SameSite=Lax/);
  return header.split(";")[0]!;
}

describe("POST /api/chat", () => {
  it("starts a conversation on the first message and sets a signed cookie", async () => {
    const chat = setup();
    const response = await chat.post({ text: "hello", nonce: randomUUID() });
    expect(response.status).toBe(200);
    const body = (await response.json()) as ChatTurnResponse;
    expect(body.replies).toEqual([{ kind: "text", text: "Hi! Which tour are you interested in?" }]);

    const cookie = cookieFrom(response);
    expect(cookie).toBe(`${CHAT_COOKIE}=${signConversationCookie(body.conversationId, SECRET)}`);

    const transcript = (await (await chat.get(cookie)).json()) as ChatTranscriptResponse;
    expect(transcript.conversationId).toBe(body.conversationId);
    expect(transcript.messages.map((m) => [m.from, m.reply])).toEqual([
      ["visitor", { kind: "text", text: "hello" }],
      ["agent", { kind: "text", text: "Hi! Which tour are you interested in?" }],
    ]);
    // The web send went through the outbox like any other channel.
    const [reply] = await db.select().from(messages).where(eq(messages.direction, "outbound"));
    expect(reply?.deliveryStatus).toBe("sent");
  });

  it("keeps the conversation for a returning cookie", async () => {
    const chat = setup();
    const first = await chat.post({ text: "hello", nonce: randomUUID() });
    const { conversationId } = (await first.json()) as ChatTurnResponse;
    const second = await chat.post({ text: "and again", nonce: randomUUID() }, cookieFrom(first));
    expect(((await second.json()) as ChatTurnResponse).conversationId).toBe(conversationId);
  });

  it("runs one turn for a resubmitted nonce and returns the same replies", async () => {
    const chat = setup();
    const nonce = randomUUID();
    const first = await chat.post({ text: "hello", nonce });
    const cookie = cookieFrom(first);
    const second = await chat.post({ text: "hello", nonce }, cookie);

    expect(second.status).toBe(200);
    expect(((await second.json()) as ChatTurnResponse).replies).toEqual(((await first.json()) as ChatTurnResponse).replies);
    expect(chat.model.doGenerateCalls).toHaveLength(1);
    expect(await db.select().from(messages)).toHaveLength(2);
  });

  it("runs one turn when two requests with the same nonce arrive together", async () => {
    const chat = setup();
    const first = await chat.post({ text: "hello", nonce: randomUUID() });
    const cookie = cookieFrom(first);

    const nonce = randomUUID();
    const [a, b] = await Promise.all([chat.post({ text: "twice", nonce }, cookie), chat.post({ text: "twice", nonce }, cookie)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(((await a.json()) as ChatTurnResponse).replies).toEqual(((await b.json()) as ChatTurnResponse).replies);
    expect(chat.model.doGenerateCalls).toHaveLength(2);
    expect(await db.select().from(messages).where(eq(messages.body, "twice"))).toHaveLength(1);
  });

  it("runs the turn again when the first one died without replies", async () => {
    const chat = setup();
    const first = await chat.post({ text: "hello", nonce: randomUUID() });
    const { conversationId } = (await first.json()) as ChatTurnResponse;
    const nonce = randomUUID();
    await db.insert(messages).values({
      conversationId,
      channel: "web",
      direction: "inbound",
      sentBy: "customer",
      body: "lost",
      clientNonce: nonce,
      createdAt: new Date(now.getTime() - 5 * 60_000),
    });

    const retry = await chat.post({ text: "lost", nonce }, cookieFrom(first));
    expect(retry.status).toBe(200);
    expect(await db.select().from(messages).where(eq(messages.body, "lost"))).toHaveLength(1);
    expect(chat.model.doGenerateCalls).toHaveLength(2);
  });

  it("starts a fresh conversation for a forged cookie and shows nothing of the other one", async () => {
    const chat = setup();
    const victim = await chat.post({ text: "my private question", nonce: randomUUID() });
    const { conversationId: victimId } = (await victim.json()) as ChatTurnResponse;
    const forged = `${CHAT_COOKIE}=${victimId}.${"0".repeat(64)}`;

    expect(await (await chat.get(forged)).json()).toEqual({ conversationId: null, messages: [] });
    const response = await chat.post({ text: "hello", nonce: randomUUID() }, forged);
    const body = (await response.json()) as ChatTurnResponse;
    expect(body.conversationId).not.toBe(victimId);

    const transcript = (await (await chat.get(cookieFrom(response))).json()) as ChatTranscriptResponse;
    expect(transcript.messages.map((m) => m.reply)).not.toContainEqual({ kind: "text", text: "my private question" });
  });

  it("maps a tapped option to its label, and treats an option it never offered as text", async () => {
    await seed(db);
    const chat = setup([
      { tools: [{ name: "listDepartures", input: { tourSlug: "sundarbans" } }] },
      { text: "Pick a departure." },
    ]);
    const first = await chat.post({ text: "when does the sundarbans tour leave?", nonce: randomUUID() });
    const cookie = cookieFrom(first);
    const choices = ((await first.json()) as ChatTurnResponse).replies.find((r) => r.kind === "choices");
    if (choices?.kind !== "choices") throw new Error("expected departure choices");
    const option = choices.options[0]!;

    await chat.post({ choiceId: option.id, nonce: randomUUID() }, cookie);
    const forgedPick = await chat.post({ choiceId: "sundarbans-2099-01-01", nonce: randomUUID() }, cookie);
    expect(forgedPick.status).toBe(400);

    const transcript = (await (await chat.get(cookie)).json()) as ChatTranscriptResponse;
    const visitor = transcript.messages.filter((m) => m.from === "visitor");
    expect(visitor.at(-1)).toMatchObject({ reply: { kind: "text", text: option.label }, choiceId: option.id });
  });

  it("rejects a request without a nonce or a message", async () => {
    const chat = setup();
    expect((await chat.post({ text: "hello" })).status).toBe(400);
    expect((await chat.post({ nonce: randomUUID() })).status).toBe(400);
    expect((await chat.post({ text: "   ", nonce: randomUUID() })).status).toBe(400);
    expect((await chat.post({ text: "x".repeat(1001), nonce: randomUUID() })).status).toBe(400);
  });

  it("processes a stuck WhatsApp event after a chat request", async () => {
    const chat = setup();
    await db.insert(webhookEvents).values({
      dedupeKey: "whatsapp.message.received:wamid.stuck",
      partitionKey: "8801700000001",
      eventType: "whatsapp.message.received",
      payload: {},
    });
    await db.update(webhookEvents).set({ updatedAt: sql`now() - interval '5 minutes'` });

    await chat.post({ text: "hello", nonce: randomUUID() });
    expect(chat.handled).toEqual([]);
    await chat.runScheduled();
    expect(chat.handled.map((e) => e.dedupeKey)).toEqual(["whatsapp.message.received:wamid.stuck"]);
    const [event] = await db.select().from(webhookEvents).orderBy(asc(webhookEvents.id));
    expect(event?.status).toBe("done");
  });
});
