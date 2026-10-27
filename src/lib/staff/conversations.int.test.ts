import { describe, expect, it, vi } from "vitest";

import { appendMessage, findOrCreateConversation } from "@/lib/conversations/store";
import { transition } from "@/lib/ownership";
import { setupTestDb } from "../../../test/int/db";
import { listHandedOver } from "./conversations";

const db = setupTestDb();

describe("listHandedOver", () => {
  it("lists only conversations a person owns, longest waiting first, with the reason", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const first = await findOrCreateConversation(db, { channel: "whatsapp", externalId: "8801700001234" });
    await appendMessage(db, { conversationId: first.id, channel: "whatsapp", direction: "inbound", sentBy: "customer", body: "please cancel my booking" });
    await transition(db, { conversationId: first.id, event: "customer_requested", because: "the customer asked to cancel a booking" });

    const second = await findOrCreateConversation(db, { channel: "whatsapp", externalId: "8801700005678", displayName: "Rahim" });
    await appendMessage(db, { conversationId: second.id, channel: "whatsapp", direction: "outbound", sentBy: "human", body: "x".repeat(120) });
    await transition(db, { conversationId: second.id, event: "human_replied" });

    // The agent's conversations, and ones handed back, are not listed.
    const agent = await findOrCreateConversation(db, { channel: "web", externalId: "visitor-1" });
    await appendMessage(db, { conversationId: agent.id, channel: "web", direction: "inbound", sentBy: "customer", body: "hi" });
    const back = await findOrCreateConversation(db, { channel: "whatsapp", externalId: "8801700009999" });
    await transition(db, { conversationId: back.id, event: "customer_requested" });
    await transition(db, { conversationId: back.id, event: "handed_back" });

    const list = await listHandedOver(db);
    expect(list.map((c) => [c.who, c.because, c.lastFrom])).toEqual([
      ["…1234", "the customer asked to cancel a booking", "customer"],
      ["Rahim", "a person replied from the inbox", "human"],
    ]);
    expect(list[0]!.preview).toBe("please cancel my booking");
    expect(list[1]!.preview).toHaveLength(90);
    expect(list[0]!.since.getTime()).toBeLessThanOrEqual(list[1]!.since.getTime());
  });

  it("shows the number's last digits, never a user id's", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const both = await findOrCreateConversation(db, { channel: "whatsapp", externalId: "BD.1000000000000001", otherIds: ["8801700001234"] });
    await transition(db, { conversationId: both.id, event: "human_replied" });
    const userIdOnly = await findOrCreateConversation(db, { channel: "whatsapp", externalId: "BD.1000000000000002" });
    await transition(db, { conversationId: userIdOnly.id, event: "human_replied" });

    const list = await listHandedOver(db);
    expect(list.map((c) => c.who)).toEqual(["…1234", "Customer"]);
    // Both are on WhatsApp, so both show the reply window.
    expect(list.every((c) => c.whatsapp !== null)).toBe(true);
  });
});
