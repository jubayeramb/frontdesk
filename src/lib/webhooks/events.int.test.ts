import { asc, eq, sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { webhookEvents, type WebhookEvent } from "@/db/schema";
import { setupTestDb } from "../../../test/int/db";
import { drain, storeEvents, sweep } from "./events";
import type { KapsoEvent } from "./normalize";

const db = setupTestDb();

function events(partitionKey: string, ...ids: string[]): KapsoEvent[] {
  return ids.map((id) => ({
    type: "whatsapp.message.received",
    dedupeKey: `whatsapp.message.received:${id}`,
    partitionKey,
    phoneNumberId: "1000000000000001",
    payload: { message: { id } },
  }));
}

const idOf = (event: WebhookEvent) => (event.payload.message as { id: string }).id;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function statuses() {
  const rows = await db.select().from(webhookEvents).orderBy(asc(webhookEvents.id));
  return rows.map((r) => [idOf(r), r.status, r.attempts]);
}

// Moves events back in time, as if they had waited for `minutes`.
async function age(minutes: number) {
  await db.update(webhookEvents).set({ updatedAt: sql`now() - make_interval(mins => ${minutes})` });
}

describe("storeEvents", () => {
  it("stores a replayed event once", async () => {
    const first = await storeEvents(db, events("8801700000001", "m1", "m2"));
    expect(first).toMatchObject({ stored: 2, partitions: ["8801700000001"] });
    expect(first.fresh.map((e) => e.dedupeKey)).toEqual(["whatsapp.message.received:m1", "whatsapp.message.received:m2"]);
    expect(await storeEvents(db, events("8801700000001", "m1", "m3"))).toMatchObject({
      stored: 1,
      fresh: [expect.objectContaining({ dedupeKey: "whatsapp.message.received:m3" })],
    });
    expect(await statuses()).toHaveLength(3);
  });
});

describe("drain", () => {
  it("runs concurrent drains without processing any event twice, in arrival order", async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `m${i + 1}`);
    await storeEvents(db, events("8801700000001", ...ids));
    const seen: string[] = [];
    let running = 0;
    let overlapped = false;
    const handle = async (event: WebhookEvent) => {
      if (++running > 1) overlapped = true;
      await pause(5);
      seen.push(idOf(event));
      running--;
    };

    // Several workers, as when a burst of webhooks each schedule a drain.
    const counts = await Promise.all(Array.from({ length: 8 }, () => drain(db, "8801700000001", handle)));

    expect(overlapped).toBe(false);
    expect(seen).toEqual(ids);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(10);
    expect((await statuses()).every(([, status]) => status === "done")).toBe(true);
  });

  it("keeps customers apart: one busy partition does not hold up another", async () => {
    await storeEvents(db, [...events("8801700000001", "a1"), ...events("8801700000002", "b1")]);
    const seen: string[] = [];
    await Promise.all([
      drain(db, "8801700000001", async (e) => void seen.push(idOf(e))),
      drain(db, "8801700000002", async (e) => void seen.push(idOf(e))),
    ]);
    expect(seen.sort()).toEqual(["a1", "b1"]);
  });

  it("logs which fields failed validation, without their values", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await storeEvents(db, events("8801700000001", "bad"));
    const schema = z.object({ message: z.object({ id: z.string(), from: z.string() }) });

    await drain(db, "8801700000001", async (event) => void schema.parse(event.payload), { retryBaseMs: 1 });

    expect(error).toHaveBeenCalledWith(expect.stringMatching(/failed on attempt 1: ZodError at message\.from \(invalid_type\)$/));
  });

  it("retries a failed event in the same drain after a short wait, before anything behind it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await storeEvents(db, events("8801700000001", "flaky", "next"));
    const seen: string[] = [];
    let failures = 0;
    const handle = async (event: WebhookEvent) => {
      if (idOf(event) === "flaky" && failures++ === 0) throw new Error("model exploded");
      seen.push(idOf(event));
    };

    const started = Date.now();
    expect(await drain(db, "8801700000001", handle, { retryBaseMs: 200 })).toBe(2);

    expect(Date.now() - started).toBeGreaterThanOrEqual(200);
    expect(seen).toEqual(["flaky", "next"]);
    expect(await statuses()).toEqual([
      ["flaky", "done", 2],
      ["next", "done", 1],
    ]);
  });

  it("fails an event after 3 attempts, keeps its error, and goes on to the next", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await storeEvents(db, events("8801700000001", "bad", "next"));
    const handle = async (event: WebhookEvent) => {
      if (idOf(event) === "bad") throw new Error("model exploded");
    };

    await drain(db, "8801700000001", handle, { retryBaseMs: 20 });

    expect(await statuses()).toEqual([
      ["bad", "failed", 3],
      ["next", "done", 1],
    ]);
    const [failed] = await db.select().from(webhookEvents).where(eq(webhookEvents.status, "failed"));
    expect(failed!.error).toBe("Error: model exploded");
  });

  it("leaves a retry that is too far off to the next request", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await storeEvents(db, events("8801700000001", "bad", "next"));
    const handle = async (event: WebhookEvent) => {
      if (idOf(event) === "bad") throw new Error("model exploded");
    };

    await drain(db, "8801700000001", handle, { retryBaseMs: 60_000 });

    expect(await statuses()).toEqual([
      ["bad", "pending", 1],
      ["next", "pending", 0],
    ]);
  });
});

describe("deferred events", () => {
  it("waits for a deferred event, keeps the ones behind it waiting, then runs them in order", async () => {
    await storeEvents(db, events("8801700000001", "echo", "next"));
    const seen: string[] = [];
    let asked = 0;

    const started = Date.now();
    await drain(db, "8801700000001", async (e) => {
      seen.push(idOf(e));
      // The echo asks to come back once, half a second later.
      if (idOf(e) === "echo" && asked++ === 0) return { deferMs: 500 };
    });

    expect(seen).toEqual(["echo", "echo", "next"]);
    expect(Date.now() - started).toBeGreaterThanOrEqual(450);
    expect(await statuses()).toEqual([
      ["echo", "done", 2],
      ["next", "done", 1],
    ]);
  });

  it("does not claim a deferred event early, nor anything behind it", async () => {
    await storeEvents(db, events("8801700000001", "echo", "next"));
    await db.update(webhookEvents).set({ notBefore: sql`now() + interval '1 minute'` }).where(sql`${webhookEvents.id} = 1`);

    const seen: string[] = [];
    expect(await drain(db, "8801700000001", async (e) => void seen.push(idOf(e)))).toBe(0);
    expect(seen).toEqual([]);
    expect(await statuses()).toEqual([
      ["echo", "pending", 0],
      ["next", "pending", 0],
    ]);
  });
});

describe("stale and stuck events", () => {
  it("retries an event whose worker died mid-turn before anything behind it", async () => {
    await storeEvents(db, events("8801700000001", "m1"));
    await db.update(webhookEvents).set({ status: "processing", attempts: 1 });
    await age(3);
    await storeEvents(db, events("8801700000001", "m2"));

    const seen: string[] = [];
    await drain(db, "8801700000001", async (e) => void seen.push(idOf(e)));

    expect(seen).toEqual(["m1", "m2"]);
  });

  it("does not touch an event another worker is still processing", async () => {
    await storeEvents(db, events("8801700000001", "m1", "m2"));
    await db.update(webhookEvents).set({ status: "processing" }).where(sql`${webhookEvents.id} = 1`);

    expect(await drain(db, "8801700000001", async () => {})).toBe(0);
  });

  it("sweeps a partition whose pending event has waited over 2 minutes", async () => {
    await storeEvents(db, [...events("8801700000001", "old"), ...events("8801700000002", "dead")]);
    await db.update(webhookEvents).set({ status: "processing", attempts: 1 }).where(sql`${webhookEvents.id} = 2`);
    await age(3);
    await storeEvents(db, events("8801700000003", "fresh"));

    const seen: string[] = [];
    await sweep(db, async (e) => void seen.push(idOf(e)));

    // A fresh event is left to the request that stored it.
    expect(seen.sort()).toEqual(["dead", "old"]);
    expect(await statuses()).toEqual([
      ["old", "done", 1],
      ["dead", "done", 2],
      ["fresh", "pending", 0],
    ]);
  });

  it("fails a stale event that is out of attempts instead of retrying it", async () => {
    await storeEvents(db, events("8801700000001", "m1"));
    await db.update(webhookEvents).set({ status: "processing", attempts: 3 });
    await age(3);

    await sweep(db, async () => {
      throw new Error("should not run");
    });

    const [row] = await db.select().from(webhookEvents);
    expect(row).toMatchObject({ status: "failed", error: "worker stopped mid-event" });
  });
});
