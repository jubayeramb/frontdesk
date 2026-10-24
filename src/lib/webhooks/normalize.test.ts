import { describe, expect, it } from "vitest";

import { kapsoFixture } from "../../../test/support/kapso-fixtures";
import { normalize } from "./normalize";

function fromFixture(name: string) {
  const { body, headers } = kapsoFixture(name);
  return normalize(JSON.parse(body), headers["x-webhook-event"] ?? null);
}

const keys = (result: ReturnType<typeof normalize>) =>
  result.kind === "events" ? result.events.map((e) => [e.dedupeKey, e.partitionKey]) : result.kind;

describe("normalize", () => {
  it("reads a single delivery as one event keyed by type and message id", () => {
    const result = fromFixture("message-received-text");
    expect(keys(result)).toEqual([
      ["whatsapp.message.received:wamid.HBgNODgwMTcwMDAwMDAwMBUCABIYIEE1OTg5RTBCOENCMUVFQjhBNjE2QUMwQ0U4MkUxNTIzAA==", "8801700000000"],
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
      [expect.stringMatching(/^whatsapp\.conversation\.ended:[0-9a-f-]{36}$/), "8801700000000"],
    ]);
  });

  it("keys a status event apart from the message it is about", () => {
    const [[delivered]] = keys(fromFixture("message-delivered")) as string[][];
    expect(delivered).toMatch(/^whatsapp\.message\.delivered:wamid\./);
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
