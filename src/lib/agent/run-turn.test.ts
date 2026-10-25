import { describe, expect, it } from "vitest";

import type { Message } from "@/db/schema";
import { MODEL_TEXT_LIMIT, toModelMessages } from "./run-turn";

const customer = (body: string): Message => ({
  id: 1,
  conversationId: "c",
  channel: "whatsapp",
  direction: "inbound",
  sentBy: "customer",
  body,
  payload: null,
  clientNonce: null,
  externalId: null,
  deliveryStatus: null,
  deliveryError: null,
  createdAt: new Date(),
});

describe("toModelMessages", () => {
  it("cuts a long customer message to the first 1,000 characters", () => {
    const essay = "x".repeat(MODEL_TEXT_LIMIT) + "y".repeat(4_000);
    expect(toModelMessages([customer(essay)])).toEqual([{ role: "user", content: "x".repeat(1_000) }]);
  });

  it("passes a short message through whole", () => {
    expect(toModelMessages([customer("How much is Sylhet?")])).toEqual([{ role: "user", content: "How much is Sylhet?" }]);
  });
});
