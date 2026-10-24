import type { Db } from "@/db/client";
import { drain, storeEvents, sweep, type EventHandler } from "./events";
import { normalize, type KapsoEvent } from "./normalize";
import { verifySignature } from "./signature";

export type ReceiveDeps = {
  db: Db;
  secret: string;
  phoneNumberId: string;
  handle: EventHandler;
  // Tells the customer a reply is coming, for events seen for the first time.
  // Runs alongside the processing, so it shows before the turn starts.
  acknowledge?: (event: KapsoEvent) => Promise<void>;
  // Runs work after the response is sent (`after` in the route).
  schedule: (work: () => Promise<void>) => void;
};

// Verify, store, acknowledge. Processing happens after the response, so Kapso
// never waits on the model.
export async function receiveKapsoWebhook(request: Request, deps: ReceiveDeps): Promise<Response> {
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-webhook-signature"), deps.secret)) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const normalized = normalize(body, request.headers.get("x-webhook-event"));
  if (normalized.kind === "test") return Response.json({ ok: true, ignored: "test delivery" });
  if (normalized.kind === "invalid") {
    // Signed by Kapso but not a shape we know: a retry would not help.
    console.warn(`kapso webhook ignored: ${normalized.reason}`);
    return Response.json({ ok: true, ignored: normalized.reason });
  }

  const events = normalized.events.filter((e) => e.phoneNumberId === null || e.phoneNumberId === deps.phoneNumberId);
  if (events.length < normalized.events.length) console.warn("kapso webhook: dropped events for another phone number");
  const { stored, fresh, partitions } = await storeEvents(deps.db, events);

  deps.schedule(async () => {
    const acknowledged = Promise.all(fresh.map((event) => deps.acknowledge?.(event).catch(() => {})));
    try {
      for (const partition of partitions) await drain(deps.db, partition, deps.handle);
      await sweep(deps.db, deps.handle);
    } catch (error) {
      // The events are stored; the next request's sweep picks them up.
      console.error(`kapso webhook processing stopped: ${error instanceof Error ? error.name : typeof error}`);
    } finally {
      await acknowledged;
    }
  });
  return Response.json({ ok: true, stored });
}
