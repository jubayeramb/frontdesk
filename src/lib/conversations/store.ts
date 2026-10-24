import { and, desc, eq, sql } from "drizzle-orm";

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
};

export async function appendMessage(db: Db, message: NewMessage): Promise<Message> {
  const [row] = await db.insert(messages).values(message).returning();
  await db
    .update(conversations)
    .set({ updatedAt: sql`now()` })
    .where(eq(conversations.id, message.conversationId));
  return row!;
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
export async function updateState(
  db: Db,
  conversationId: string,
  patch: ConversationState,
): Promise<void> {
  await db
    .update(conversations)
    .set({
      state: sql`${conversations.state} || ${JSON.stringify(patch)}::jsonb`,
      updatedAt: sql`now()`,
    })
    .where(eq(conversations.id, conversationId));
}
