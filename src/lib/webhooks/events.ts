import { and, asc, eq, gt, lt, sql, type SQL } from "drizzle-orm";

import type { Db } from "@/db/client";
import { webhookEvents, type WebhookEvent } from "@/db/schema";
import type { KapsoEvent } from "./normalize";

export const MAX_ATTEMPTS = 3;
// A `processing` row older than this is taken to belong to a worker that died.
export const STALE_AFTER = sql`interval '2 minutes'`;
// Enough for any one customer's burst; the next request picks up the rest.
const MAX_PER_DRAIN = 25;

// A handler that cannot decide yet (an echo of a send whose id is not stored
// yet) asks to be called again later instead of finishing.
export type EventHandler = (event: WebhookEvent) => Promise<void | { deferMs: number }>;

// How long a drain waits in place for a deferred event before leaving it to
// the next request or the sweep.
const MAX_WAIT_MS = 15_000;

// Stores each event once. Returns the events stored for the first time, and
// the partitions the delivery touched, including ones whose events were
// already stored, so they get drained.
export async function storeEvents(
  db: Db,
  events: KapsoEvent[],
): Promise<{ stored: number; fresh: KapsoEvent[]; partitions: string[] }> {
  if (events.length === 0) return { stored: 0, fresh: [], partitions: [] };
  const rows = await db
    .insert(webhookEvents)
    .values(
      events.map((e) => ({ dedupeKey: e.dedupeKey, partitionKey: e.partitionKey, eventType: e.type, payload: e.payload })),
    )
    .onConflictDoNothing({ target: webhookEvents.dedupeKey })
    .returning({ dedupeKey: webhookEvents.dedupeKey });
  const inserted = new Set(rows.map((r) => r.dedupeKey));
  return {
    stored: rows.length,
    fresh: events.filter((e) => inserted.has(e.dedupeKey)),
    partitions: [...new Set(events.map((e) => e.partitionKey))],
  };
}

// Claims the oldest pending event of a partition, unless another worker is
// still processing one there. The transaction-scoped advisory lock makes the
// check and the claim one step, so two workers can never both start. A
// deferred head is not claimed early, and nothing behind it overtakes it:
// the result says when to come back instead.
export async function claimNext(db: Db, partitionKey: string): Promise<WebhookEvent | { waitUntil: Date } | null> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${partitionKey}, 0))`);
    // A dead worker's event goes back in line first, so it is not overtaken.
    await releaseStale(tx, eq(webhookEvents.partitionKey, partitionKey));
    const [busy] = await tx
      .select({ id: webhookEvents.id })
      .from(webhookEvents)
      .where(
        and(
          eq(webhookEvents.partitionKey, partitionKey),
          eq(webhookEvents.status, "processing"),
          gt(webhookEvents.updatedAt, sql`now() - ${STALE_AFTER}`),
        ),
      )
      .limit(1);
    if (busy) return null;

    const [next] = await tx
      .select({ id: webhookEvents.id, notBefore: webhookEvents.notBefore, ready: sql<boolean>`${webhookEvents.notBefore} is null or ${webhookEvents.notBefore} <= now()` })
      .from(webhookEvents)
      .where(and(eq(webhookEvents.partitionKey, partitionKey), eq(webhookEvents.status, "pending")))
      .orderBy(asc(webhookEvents.createdAt), asc(webhookEvents.id))
      .limit(1);
    if (!next) return null;
    if (!next.ready) return { waitUntil: next.notBefore! };

    const [claimed] = await tx
      .update(webhookEvents)
      .set({ status: "processing", attempts: sql`${webhookEvents.attempts} + 1`, updatedAt: sql`now()` })
      .where(eq(webhookEvents.id, next.id))
      .returning();
    return claimed ?? null;
  });
}

async function defer(db: Db, event: WebhookEvent, ms: number): Promise<void> {
  await db
    .update(webhookEvents)
    .set({ status: "pending", notBefore: sql`now() + make_interval(secs => ${ms / 1000})`, updatedAt: sql`now()` })
    .where(eq(webhookEvents.id, event.id));
}

async function finish(db: Db, event: WebhookEvent, error?: unknown): Promise<void> {
  if (error === undefined) {
    await db.update(webhookEvents).set({ status: "done", error: null, updatedAt: sql`now()` }).where(eq(webhookEvents.id, event.id));
    return;
  }
  await db
    .update(webhookEvents)
    .set({
      status: event.attempts >= MAX_ATTEMPTS ? "failed" : "pending",
      error: describe(error),
      updatedAt: sql`now()`,
    })
    .where(eq(webhookEvents.id, event.id));
}

// Processes a partition's pending events one at a time, in arrival order.
// Stops at the first failure: the event stays first in line, and a later
// sweep retries it, so nothing behind it runs out of order.
export async function drain(db: Db, partitionKey: string, handle: EventHandler): Promise<number> {
  let processed = 0;
  while (processed < MAX_PER_DRAIN) {
    const event = await claimNext(db, partitionKey);
    if (!event) break;
    if ("waitUntil" in event) {
      const wait = event.waitUntil.getTime() - Date.now();
      if (wait > MAX_WAIT_MS) break;
      await new Promise((resolve) => setTimeout(resolve, Math.max(wait, 0) + 50));
      continue;
    }
    let result: Awaited<ReturnType<EventHandler>>;
    try {
      result = await handle(event);
    } catch (error) {
      await finish(db, event, error);
      console.error(`webhook event ${event.id} (${event.eventType}) failed on attempt ${event.attempts}: ${errorClass(error)}`);
      break;
    }
    if (result?.deferMs) {
      await defer(db, event, result.deferMs);
      continue;
    }
    await finish(db, event);
    processed++;
  }
  return processed;
}

// Recovers work left behind: a `processing` row whose worker died goes back
// to pending (or failed, out of attempts), and every partition with a pending
// event that has waited past the stale window is drained.
export async function sweep(db: Db, handle: EventHandler): Promise<void> {
  await releaseStale(db);

  const waiting = await db
    .selectDistinct({ partitionKey: webhookEvents.partitionKey })
    .from(webhookEvents)
    .where(and(eq(webhookEvents.status, "pending"), lt(webhookEvents.updatedAt, sql`now() - ${STALE_AFTER}`)))
    .limit(20);
  for (const { partitionKey } of waiting) await drain(db, partitionKey, handle);
}

// Leaves updated_at alone, so a released event counts as waiting.
async function releaseStale(db: Pick<Db, "update">, scope?: SQL): Promise<void> {
  await db
    .update(webhookEvents)
    .set({
      status: sql`case when ${webhookEvents.attempts} >= ${MAX_ATTEMPTS} then 'failed' else 'pending' end::webhook_event_status`,
      error: sql`coalesce(${webhookEvents.error}, 'worker stopped mid-event')`,
    })
    .where(and(eq(webhookEvents.status, "processing"), lt(webhookEvents.updatedAt, sql`now() - ${STALE_AFTER}`), scope));
}

function describe(error: unknown): string {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return text.slice(0, 500);
}

function errorClass(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}
