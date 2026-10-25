import { and, asc, desc, eq, gt, isNull, sql } from "drizzle-orm";

import type { Db } from "@/db/client";
import {
  channelIdentities,
  contacts,
  conversations,
  messages,
  type Channel,
  type Conversation,
  type Message,
} from "@/db/schema";
import type { ChoiceOption } from "@/lib/agent/replies";
import type { ConversationState } from "./state";

export const HISTORY_WINDOW = 20;

// Finds the contact behind a channel identity (or creates both) and returns
// their latest conversation, starting one if they have none.
export async function findOrCreateConversation(
  db: Db,
  input: { channel: Channel; externalId: string; displayName?: string },
): Promise<Conversation> {
  return db.transaction(async (tx) => {
    let [identity] = await tx
      .select()
      .from(channelIdentities)
      .where(
        and(
          eq(channelIdentities.channel, input.channel),
          eq(channelIdentities.externalId, input.externalId),
        ),
      );
    if (!identity) {
      // Insert-or-nothing on the identity, so two first messages at once still
      // end up with one contact.
      const [contact] = await tx
        .insert(contacts)
        .values({ displayName: input.displayName ?? null })
        .returning();
      await tx
        .insert(channelIdentities)
        .values({ contactId: contact!.id, channel: input.channel, externalId: input.externalId })
        .onConflictDoNothing();
      [identity] = await tx
        .select()
        .from(channelIdentities)
        .where(
          and(
            eq(channelIdentities.channel, input.channel),
            eq(channelIdentities.externalId, input.externalId),
          ),
        );
      // Lost a race with another first message: drop the contact we just made.
      if (identity && identity.contactId !== contact!.id) {
        await tx.delete(contacts).where(eq(contacts.id, contact!.id));
      }
    }
    const contactId = identity!.contactId;

    const [latest] = await tx
      .select()
      .from(conversations)
      .where(eq(conversations.contactId, contactId))
      .orderBy(desc(conversations.createdAt))
      .limit(1);
    if (latest) return latest;

    const [created] = await tx.insert(conversations).values({ contactId }).returning();
    return created!;
  });
}

// The latest conversation behind a channel identity, without creating one.
export async function findConversation(
  db: Db,
  input: { channel: Channel; externalId: string },
): Promise<Conversation | undefined> {
  const [row] = await db
    .select({ conversation: conversations })
    .from(channelIdentities)
    .innerJoin(conversations, eq(conversations.contactId, channelIdentities.contactId))
    .where(and(eq(channelIdentities.channel, input.channel), eq(channelIdentities.externalId, input.externalId)))
    .orderBy(desc(conversations.createdAt))
    .limit(1);
  return row?.conversation;
}

export async function getConversation(db: Db, id: string): Promise<Conversation | undefined> {
  const [row] = await db.select().from(conversations).where(eq(conversations.id, id));
  return row;
}

export type NewMessage = {
  conversationId: string;
  channel: Channel;
  direction: "inbound" | "outbound";
  sentBy: "customer" | "ai" | "human" | "system";
  body: string;
  payload?: Record<string, unknown>;
  clientNonce?: string;
  externalId?: string;
  deliveryStatus?: "pending" | "sent" | "failed" | "suppressed";
};

export async function appendMessage(db: Db, message: NewMessage): Promise<Message> {
  const [row] = await appendMessages(db, message.conversationId, [message]);
  return row!;
}

// One insert, so a reader sees all of a turn's replies or none of them.
export async function appendMessages(db: Db, conversationId: string, rows: NewMessage[]): Promise<Message[]> {
  const stored = await db.insert(messages).values(rows).returning();
  await db.update(conversations).set({ updatedAt: sql`now()` }).where(eq(conversations.id, conversationId));
  return stored.sort((a, b) => a.id - b.id);
}

export async function findByNonce(db: Db, conversationId: string, nonce: string): Promise<Message | undefined> {
  const [row] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.clientNonce, nonce)));
  return row;
}

// The replies to one customer message: what was sent after it, up to the
// customer's next message.
export async function repliesTo(db: Db, inbound: Message): Promise<Message[]> {
  const after = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, inbound.conversationId), gt(messages.id, inbound.id)))
    .orderBy(asc(messages.id))
    .limit(HISTORY_WINDOW);
  const next = after.findIndex((m) => m.direction === "inbound");
  return (next === -1 ? after : after.slice(0, next)).filter((m) => m.direction === "outbound");
}

export async function deleteMessage(db: Db, id: number): Promise<void> {
  await db.delete(messages).where(eq(messages.id, id));
}

// The last `limit` messages, oldest first.
export async function loadWindow(
  db: Db,
  conversationId: string,
  limit = HISTORY_WINDOW,
): Promise<Message[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.id))
    .limit(limit);
  return rows.reverse();
}

// Shallow-merges into the state; a key in the patch replaces the stored one.
// `remove` drops keys in the same statement, such as a quote a booking used up.
export async function updateState(
  db: Db,
  conversationId: string,
  patch: ConversationState,
  remove: (keyof ConversationState)[] = [],
): Promise<void> {
  await db
    .update(conversations)
    .set({
      state: sql`(${conversations.state} || ${JSON.stringify(patch)}::jsonb) - ${`{${remove.join(",")}}`}::text[]`,
      updatedAt: sql`now()`,
    })
    .where(eq(conversations.id, conversationId));
}

// Outbox: a message is marked pending with our nonce before the send, then
// gets the channel's id, or the error that stopped it.
export async function markSending(db: Db, messageId: number, nonce: string): Promise<void> {
  await db
    .update(messages)
    .set({ clientNonce: nonce, deliveryStatus: "pending" })
    .where(eq(messages.id, messageId));
}

export async function markSent(db: Db, messageId: number, externalId: string | null): Promise<void> {
  await db
    .update(messages)
    .set({ externalId, deliveryStatus: "sent", deliveryError: null })
    .where(eq(messages.id, messageId));
}

// By our id after a rejected send, or by the channel's id when a failure is
// reported later. Returns whether a message matched.
export async function markFailed(
  db: Db,
  target: { id: number } | { externalId: string },
  error: string,
): Promise<boolean> {
  const rows = await db
    .update(messages)
    .set({ deliveryStatus: "failed", deliveryError: error })
    .where("id" in target ? eq(messages.id, target.id) : eq(messages.externalId, target.externalId))
    .returning({ id: messages.id });
  return rows.length > 0;
}

// Whether an agent send in this conversation is still waiting for the
// channel's id, so an unknown echo may yet turn out to be ours.
export async function hasSendInFlight(db: Db, conversationId: string, since: Date): Promise<boolean> {
  const [row] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.sentBy, "ai"),
        eq(messages.deliveryStatus, "pending"),
        isNull(messages.externalId),
        gt(messages.createdAt, since),
      ),
    )
    .limit(1);
  return row !== undefined;
}

export async function findByExternalId(db: Db, externalId: string): Promise<Message | undefined> {
  const [row] = await db.select().from(messages).where(eq(messages.externalId, externalId));
  return row;
}

// The options of the latest choices reply, so a later tap or number maps back.
export async function lastChoices(db: Db, conversationId: string): Promise<ChoiceOption[] | null> {
  const [row] = await db
    .select({ payload: messages.payload })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.direction, "outbound"),
        sql`${messages.payload}->>'kind' = 'choices'`,
      ),
    )
    .orderBy(desc(messages.id))
    .limit(1);
  return (row?.payload?.options as ChoiceOption[] | undefined) ?? null;
}

// Remembers Kapso's conversation and when the customer last wrote, which
// opens WhatsApp's 24-hour reply window.
export async function noteWhatsAppInbound(
  db: Db,
  conversationId: string,
  input: { kapsoConversationId?: string; at: Date },
): Promise<void> {
  await db
    .update(conversations)
    .set({
      kapsoConversationId: input.kapsoConversationId ?? sql`${conversations.kapsoConversationId}`,
      waLastInboundAt: sql`greatest(${conversations.waLastInboundAt}, ${input.at.toISOString()}::timestamptz)`,
    })
    .where(eq(conversations.id, conversationId));
}
