import { randomUUID } from "node:crypto";

import { test, type BrowserContext } from "@playwright/test";

import { createDb } from "../src/db/client";
import { CHAT_COOKIE, signConversationCookie } from "../src/lib/web-chat/cookie";
import { E2E_ENV } from "./env";

// Conversations written straight to the e2e database, and the cookie that
// makes a browser their visitor.
export type Row = { channel: "web" | "whatsapp"; sentBy: "customer" | "ai" | "human" | "system"; body: string; payload?: object };

export async function query<T>(work: (q: (sql: string, params?: unknown[]) => Promise<unknown>) => Promise<T>): Promise<T> {
  const { pool } = createDb(E2E_ENV.DATABASE_URL, E2E_ENV.DATABASE_WS_PROXY);
  try {
    return await work((sql, params) => pool.query(sql, params));
  } finally {
    await pool.end();
  }
}

// A web visitor's conversation, optionally continued on a WhatsApp number.
export async function conversation(opts: { owner?: "ai" | "human"; whatsapp?: string; rows: Row[] }): Promise<string> {
  const contactId = randomUUID();
  const conversationId = randomUUID();
  await query(async (q) => {
    await q("insert into contacts (id) values ($1)", [contactId]);
    await q("insert into channel_identities (contact_id, channel, external_id) values ($1, 'web', $2)", [contactId, randomUUID()]);
    if (opts.whatsapp) {
      await q("insert into channel_identities (contact_id, channel, external_id) values ($1, 'whatsapp', $2)", [contactId, opts.whatsapp]);
    }
    await q("insert into conversations (id, contact_id, owner) values ($1, $2, $3)", [conversationId, contactId, opts.owner ?? "ai"]);
    for (const row of opts.rows) await addMessage(q, conversationId, row);
  });
  return conversationId;
}

export async function addMessage(q: (sql: string, params?: unknown[]) => Promise<unknown>, conversationId: string, row: Row) {
  await q(
    `insert into messages (conversation_id, channel, direction, sent_by, body, payload)
     values ($1, $2, $3, $4, $5, $6)`,
    [conversationId, row.channel, row.sentBy === "customer" ? "inbound" : "outbound", row.sentBy, row.body, row.payload ?? null],
  );
}

// A number unique to this run that ends in the given 4 digits.
export const number = (last4: string) => `8801${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}${last4}`;

export async function visit(context: BrowserContext, conversationId: string) {
  await context.addCookies([
    {
      name: CHAT_COOKIE,
      value: signConversationCookie(conversationId, E2E_ENV.CHAT_COOKIE_SECRET),
      url: test.info().project.use.baseURL!,
      httpOnly: true,
    },
  ]);
}
