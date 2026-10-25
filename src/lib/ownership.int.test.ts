import { asc, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { messages } from "@/db/schema";
import { getConversation } from "@/lib/conversations/store";
import { setupTestDb } from "../../test/int/db";
import { newConversation } from "../../test/int/fixtures";
import { transition } from "./ownership";

const db = setupTestDb();

describe("transition", () => {
  it("records each change with its reason, and writes nothing for a no-op", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { id } = await newConversation(db, "whatsapp");

    expect(await transition(db, { conversationId: id, event: "customer_requested" })).toEqual({ owner: "human", changed: true });
    expect(await transition(db, { conversationId: id, event: "human_replied" })).toEqual({ owner: "human", changed: false });
    expect(await transition(db, { conversationId: id, event: "handed_back" })).toEqual({ owner: "ai", changed: true });

    const conversation = await getConversation(db, id);
    expect(conversation).toMatchObject({ owner: "ai", ownerChangedAt: expect.any(Date) });
    const notes = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.id));
    expect(notes.map((m) => [m.sentBy, m.body, m.payload])).toEqual([
      ["system", "Handed to a person: the customer asked for a person.", { kind: "ownership", from: "ai", to: "human", reason: "customer_requested", because: "the customer asked for a person" }],
      ["system", "Handed back to the agent: staff handed it back.", { kind: "ownership", from: "human", to: "ai", reason: "handed_back", because: "staff handed it back" }],
    ]);
  });

  it("uses the caller's reason when given one", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { id } = await newConversation(db, "whatsapp");

    await transition(db, { conversationId: id, event: "customer_requested", because: "the customer asked to cancel a booking" });

    const [note] = await db.select().from(messages).where(eq(messages.conversationId, id));
    expect(note).toMatchObject({
      body: "Handed to a person: the customer asked to cancel a booking.",
      payload: { kind: "ownership", from: "ai", to: "human", reason: "customer_requested", because: "the customer asked to cancel a booking" },
    });
  });
});
