import { describe, expect, it } from "vitest";

import { kapsoFixture } from "../../../test/support/kapso-fixtures";
import { customerAddress, customerOf, normalize } from "./normalize";

function fromFixture(name: string) {
  const { body, headers } = kapsoFixture(name);
  return normalize(JSON.parse(body), headers["x-webhook-event"] ?? null);
}

const keys = (result: ReturnType<typeof normalize>) =>
  result.kind === "events" ? result.events.map((e) => [e.dedupeKey, e.partitionKey]) : result.kind;

describe("normalize", () => {
  it("reads a single delivery as one event keyed by type and message id, queued by user id", () => {
    const result = fromFixture("message-received-text");
    expect(keys(result)).toEqual([
      ["whatsapp.message.received:wamid.HBgNODgwMTcwMDAwMDAwMBUCABIYIEE1OTg5RTBCOENCMUVFQjhBNjE2QUMwQ0U4MkUxNTIzAA==", "BD.1000000000000001"],
    ]);
    expect(result.kind === "events" && result.events[0]).toMatchObject({
      type: "whatsapp.message.received",
      phoneNumberId: "1382322134966757",
    });
  });

  it("splits a batch into its events, in order, each with its own key", () => {
    const result = fromFixture("message-received-batch");
    expect(result.kind === "events" && result.events.map((e) => (e.payload.message as { text: { body: string } }).text.body)).toEqual(["X", "Y", "Z"]);
    const dedupeKeys = result.kind === "events" ? result.events.map((e) => e.dedupeKey) : [];
    expect(new Set(dedupeKeys).size).toBe(3);
  });

  it("keys conversation events by conversation id", () => {
    expect(keys(fromFixture("conversation-ended"))).toEqual([
      [expect.stringMatching(/^whatsapp\.conversation\.ended:[0-9a-f-]{36}$/), "BD.1000000000000001"],
    ]);
  });

  it("keys a status event apart from the message it is about", () => {
    const [[delivered]] = keys(fromFixture("message-delivered")) as string[][];
    expect(delivered).toMatch(/^whatsapp\.message\.delivered:wamid\./);
  });

  it("keys a customer Meta reports by user id only", () => {
    expect(keys(fromFixture("message-received-text-user-id"))).toEqual([
      [expect.stringMatching(/^whatsapp\.message\.received:wamid\./), "BD.1000000000000002"],
    ]);
    expect(keys(fromFixture("conversation-created-user-id"))).toEqual([
      ["whatsapp.conversation.created:6f0d3c1e-2b8a-4c55-9e57-3a1f0b9d7c42", "BD.1000000000000002"],
    ]);
  });

  it("falls back to the phone number when there is no user id", () => {
    const result = normalize({ message: { id: "wamid.1", from: "+880 1700-000000" } }, "whatsapp.message.received");
    expect(keys(result)).toEqual([["whatsapp.message.received:wamid.1", "8801700000000"]]);
  });

  it("drops Kapso test deliveries", () => {
    expect(fromFixture("message-received-test-delivery")).toEqual({ kind: "test" });
  });

  it("rejects bodies it cannot key", () => {
    expect(normalize([], "whatsapp.message.received").kind).toBe("invalid");
    expect(normalize({ message: { id: "wamid.1" } }, null).kind).toBe("invalid");
    expect(normalize({ message: {} }, "whatsapp.message.received").kind).toBe("invalid");
  });
});

describe("customerOf", () => {
  it("reads the phone number and the user id together", () => {
    const body = JSON.parse(kapsoFixture("message-received-text").body);
    expect(customerOf(body)).toEqual({ phone: "8801700000000", userId: "BD.1000000000000001" });
    expect(customerAddress(customerOf(body))).toBe("8801700000000");
  });

  it("addresses a customer with no phone number by user id", () => {
    const body = JSON.parse(kapsoFixture("message-received-text-user-id").body);
    expect(customerOf(body)).toEqual({ userId: "BD.1000000000000002" });
    expect(customerAddress(customerOf(body))).toBe("BD.1000000000000002");
  });
});
