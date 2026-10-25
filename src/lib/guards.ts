import { and, eq, isNull, lt, or, sql } from "drizzle-orm";

import type { Db } from "@/db/client";
import { contacts, turns, type Conversation } from "@/db/schema";

export const UNSUPPORTED_REPLY = "I can only read text for now.";
export const CONTACT_LIMIT_REPLY = "You've hit the demo limit. Try again in a bit.";
export const GLOBAL_LIMIT_REPLY = "The demo is resting for today. Try again tomorrow.";

// Turns that call the model: per contact in any rolling hour and per UTC day,
// and for everyone together per UTC day.
export type Limits = { perHour: number; perDay: number; globalPerDay: number };
export const DEFAULT_LIMITS: Limits = { perHour: 20, perDay: 60, globalPerDay: 250 };

// What a stored customer message gets: a turn, a fixed reply with no model
// call, or nothing.
export type Guard = { action: "run" } | { action: "reply"; text: string } | { action: "silent" };

// Every check that can stop a turn before the model, in order. Messages that
// get no reply at all (reactions, statuses) never reach here.
export async function checkGuards(
  db: Db,
  input: { conversation: Conversation; unsupported: boolean; now: Date; limits?: Limits },
): Promise<Guard> {
  const { conversation, now } = input;
  const limits = input.limits ?? DEFAULT_LIMITS;
  // A person sees the message in the inbox, photos included.
  if (conversation.owner === "human") return { action: "silent" };
  if (input.unsupported) return { action: "reply", text: UNSUPPORTED_REPLY };

  const usage = await countTurns(db, conversation.contactId, now);
  if (usage.today >= limits.globalPerDay) return limitReply(db, conversation.contactId, now, usage.lastToday, GLOBAL_LIMIT_REPLY);
  if (usage.contactHour >= limits.perHour || usage.contactToday >= limits.perDay) {
    return limitReply(db, conversation.contactId, now, usage.contactLast, CONTACT_LIMIT_REPLY);
  }
  return { action: "run" };
}

// No turn runs while a limit holds, so the latest counted turn is when it was
// reached. A contact told after that has heard it for this window, and their
// next messages are kept without a reply. One update decides, so two messages
// at once still get one reply.
async function limitReply(db: Db, contactId: string, now: Date, reachedAt: Date | null, text: string): Promise<Guard> {
  const told = await db
    .update(contacts)
    .set({ limitNotifiedAt: now })
    .where(
      and(
        eq(contacts.id, contactId),
        reachedAt ? or(isNull(contacts.limitNotifiedAt), lt(contacts.limitNotifiedAt, reachedAt)) : isNull(contacts.limitNotifiedAt),
      ),
    )
    .returning({ id: contacts.id });
  return told.length > 0 ? { action: "reply", text } : { action: "silent" };
}

type Usage = { contactHour: number; contactToday: number; contactLast: Date | null; today: number; lastToday: Date | null };

async function countTurns(db: Db, contactId: string, now: Date): Promise<Usage> {
  const hourAgo = new Date(now.getTime() - 60 * 60_000);
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const since = hourAgo < dayStart ? hourAgo : dayStart;
  const mine = sql`${turns.contactId} = ${contactId}`;
  const today = sql`${turns.createdAt} >= ${dayStart.toISOString()}::timestamptz`;
  const [row] = await db
    .select({
      contactHour: sql<number>`count(*) filter (where ${mine} and ${turns.createdAt} > ${hourAgo.toISOString()}::timestamptz)`.mapWith(Number),
      contactToday: sql<number>`count(*) filter (where ${mine} and ${today})`.mapWith(Number),
      contactLast: sql<string | null>`max(${turns.createdAt}) filter (where ${mine})`,
      today: sql<number>`count(*) filter (where ${today})`.mapWith(Number),
      lastToday: sql<string | null>`max(${turns.createdAt}) filter (where ${today})`,
    })
    .from(turns)
    .where(sql`${turns.createdAt} >= ${since.toISOString()}::timestamptz`);
  return {
    contactHour: row?.contactHour ?? 0,
    contactToday: row?.contactToday ?? 0,
    contactLast: row?.contactLast ? new Date(row.contactLast) : null,
    today: row?.today ?? 0,
    lastToday: row?.lastToday ? new Date(row.lastToday) : null,
  };
}

// One row per turn that called the model, at the turn's own clock.
export async function recordTurn(
  db: Db,
  input: { contactId: string; conversationId: string; model: string | null; inputTokens: number; outputTokens: number; at: Date },
): Promise<void> {
  const { at, ...row } = input;
  await db.insert(turns).values({ ...row, createdAt: at });
}
