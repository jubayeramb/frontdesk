import { createHmac } from "node:crypto";

import { asc } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { webhookEvents } from "@/db/schema";
import { setupTestDb } from "../../../test/int/db";
import { FIXTURE_SECRET, fixtureRequest, kapsoFixture } from "../../../test/support/kapso-fixtures";
import type { EventHandler } from "./events";
import { receiveKapsoWebhook } from "./receive";

const db = setupTestDb();
const PHONE_NUMBER_ID = "1382322134966757";

// Captures the after-response work instead of running it, so a test can look
// at the state between the response and the processing.
function setup(handle: EventHandler = async () => {}) {
  const scheduled: (() => Promise<void>)[] = [];
  const deps = { db, secret: FIXTURE_SECRET, phoneNumberId: PHONE_NUMBER_ID, handle, schedule: (w: () => Promise<void>) => void scheduled.push(w) };
  return {
    receive: (request: Request) => receiveKapsoWebhook(request, deps),
    runScheduled: async () => {
      for (const work of scheduled.splice(0)) await work();
    },
  };
}

const rows = () => db.select().from(webhookEvents).orderBy(asc(webhookEvents.id));

describe("POST /api/webhooks/kapso", () => {
  it("rejects a forged request with 401 and stores nothing", async () => {
    const { receive } = setup();
    const forged = fixtureRequest("message-received-text", undefined, { secret: "not-the-secret" });
    expect((await receive(forged)).status).toBe(401);

    const unsigned = fixtureRequest("message-received-text");
    unsigned.headers.delete("x-webhook-signature");
    expect((await receive(unsigned)).status).toBe(401);
    expect(await rows()).toEqual([]);
  });

  it("accepts the captured bytes exactly as Kapso signed them", async () => {
    const { body, headers } = kapsoFixture("message-received-text");
    const response = await setup().receive(new Request("http://localhost/api/webhooks/kapso", { method: "POST", headers, body }));
    expect(response.status).toBe(200);
  });

  it("stores a replayed fixture once and answers 200 both times", async () => {
    const { receive } = setup();
    const first = await receive(fixtureRequest("message-received-text"));
    const second = await receive(fixtureRequest("message-received-text"));

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(await first.json()).toEqual({ ok: true, stored: 1 });
    expect(await second.json()).toEqual({ ok: true, stored: 0 });
    expect(await rows()).toHaveLength(1);
  });

  it("stores each event of a batch, in order", async () => {
    await setup().receive(fixtureRequest("message-received-batch"));
    const stored = await rows();
    expect(stored.map((r) => (r.payload.message as { text: { body: string } }).text.body)).toEqual(["X", "Y", "Z"]);
    expect(stored.every((r) => r.partitionKey === "BD.1000000000000001" && r.status === "pending")).toBe(true);
  });

  it("acknowledges before any event is processed", async () => {
    const handle = vi.fn<EventHandler>(async () => {});
    const { receive, runScheduled } = setup(handle);

    const response = await receive(fixtureRequest("message-received-text"));

    expect(response.status).toBe(200);
    expect(handle).not.toHaveBeenCalled();
    await runScheduled();
    expect(handle).toHaveBeenCalledOnce();
    expect((await rows())[0]!.status).toBe("done");
  });

  it("drops Kapso test deliveries and events for another number", async () => {
    const { receive } = setup();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await (await receive(fixtureRequest("message-received-test-delivery"))).json()).toMatchObject({ ignored: "test delivery" });
    await receive(fixtureRequest("message-received-text", (b) => (b.phone_number_id = "999")));
    expect(await rows()).toEqual([]);
  });

  it("answers 400 to a signed body that is not JSON", async () => {
    const body = "not json";
    const request = new Request("http://localhost/api/webhooks/kapso", {
      method: "POST",
      headers: { "x-webhook-signature": createHmac("sha256", FIXTURE_SECRET).update(body).digest("hex") },
      body,
    });
    expect((await setup().receive(request)).status).toBe(400);
  });
});
