import { eq, sql } from "drizzle-orm";

import type { Db } from "@/db/client";
import { conversations, messages, type Channel } from "@/db/schema";

export type Owner = "ai" | "human";
export type OwnershipEvent = "customer_requested" | "human_replied" | "handed_back" | "conversation_ended";

const REASONS: Record<OwnershipEvent, string> = {
  customer_requested: "the customer asked for a person",
  human_replied: "a person replied from the inbox",
  handed_back: "staff handed it back",
  conversation_ended: "Kapso ended the conversation",
};

// The whole state machine: a person takes over when asked or when they reply,
// and the agent gets it back on hand back or when the conversation ends.
// Every other pair leaves the owner as it is.
export function nextOwner(owner: Owner, event: OwnershipEvent): Owner {
  if (owner === "ai" && (event === "customer_requested" || event === "human_replied")) return "human";
  if (owner === "human" && (event === "handed_back" || event === "conversation_ended")) return "ai";
  return owner;
}

// The only place ownership changes. The owner, when it changed, and a system
// message saying why are written together; a no-op writes nothing. `because`
// replaces the event's stock reason when the caller knows more.
export async function transition(
  db: Db,
  input: { conversationId: string; event: OwnershipEvent; channel?: Channel; because?: string },
): Promise<{ owner: Owner; changed: boolean }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ owner: conversations.owner })
      .from(conversations)
      .where(eq(conversations.id, input.conversationId))
      .for("update");
    if (!row) throw new Error(`Unknown conversation ${input.conversationId}`);

    const owner = nextOwner(row.owner, input.event);
    if (owner === row.owner) return { owner, changed: false };

    await tx
      .update(conversations)
      .set({ owner, ownerChangedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(conversations.id, input.conversationId));
    const because = input.because ?? REASONS[input.event];
    await tx.insert(messages).values({
      conversationId: input.conversationId,
      // Only WhatsApp conversations are ever answered by a person.
      channel: input.channel ?? "whatsapp",
      direction: "outbound",
      sentBy: "system",
      body: `${owner === "human" ? "Handed to a person" : "Handed back to the agent"}: ${because}.`,
      payload: { kind: "ownership", from: row.owner, to: owner, reason: input.event, because },
    });
    console.info(`conversation ${input.conversationId} owner ${row.owner} -> ${owner} (${input.event})`);
    return { owner, changed: true };
  });
}
