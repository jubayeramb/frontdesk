# Design

## Context

The agent core returns `AgentReply[]` and persists messages (add-agent-core).
Fixtures for every event live in `test/fixtures/kapso/`, and the spike's findings say which dedupe key is stable across retries and what the batch envelope looks like.
Where this design says "per the spike", use the recorded finding.

## Goals / Non-Goals

**Goals:**
- Correct under at-least-once delivery, concurrency, and serverless instances that die after the response.
- The adapter is the only module that calls Kapso's send API.

**Non-Goals:**
- A general job queue.
  One table and one claim query cover this load.
- WhatsApp Flows.
  Buttons and lists are enough for slots.

## Decisions

### Adapter interface

```ts
interface ChannelAdapter {
  channel: "web" | "whatsapp";
  capabilities(): { buttons: number; listRows: number; markdown: boolean };
  replyPolicy(conv: Conversation, now: Date): { canSendFreeForm: boolean; reason?: string };
  render(reply: AgentReply): OutboundMessage[];
  send(conv: Conversation, msgs: OutboundMessage[]): Promise<{ externalId?: string }[]>;
}
```

`render` is pure and holds all degradation rules, so the rendering spec is unit-tested without the network.
`replyPolicy` returns "always allowed" here; add-guards-and-retention fills in the 24-hour rule.
The last numbered `choices` payload is stored on the outbound message, so a later "7" can be resolved against it.

### Pipeline

1. `route.ts` reads `await req.text()`, verifies `X-Webhook-Signature` (64 hex chars, `timingSafeEqual` on the HMAC-SHA256 of the raw body).
2. Normalize to a list of events: a batch envelope becomes many, a single payload becomes one.
3. Insert each into `webhook_events(dedupe_key unique, partition_key, event_type, payload, status, attempts, error, created_at)` with `ON CONFLICT DO NOTHING`.
   `dedupe_key` is per the spike: `X-Idempotency-Key` if stable across retries and unique per event in a batch, otherwise `event_type + ":" + message.id` (or conversation id for conversation events).
   `partition_key` is the customer's WhatsApp number.
4. Return 200, and schedule `drain(partitionKey)` with `after()` for each partition touched, plus one `sweep()`.

### Claim and drain

```sql
SELECT id FROM webhook_events
WHERE partition_key = $1 AND status = 'pending'
  AND NOT EXISTS (SELECT 1 FROM webhook_events p
                  WHERE p.partition_key = $1 AND p.status = 'processing'
                    AND p.updated_at > now() - interval '2 minutes')
ORDER BY created_at, id
LIMIT 1
FOR UPDATE SKIP LOCKED
```

The claim sets `status = 'processing'` in the same transaction; the turn runs outside it; the event ends `done` or back to `pending` with `attempts + 1` (`failed` at 3).
The `NOT EXISTS` clause keeps order: a second worker cannot start a later event while an earlier one is processing.
`sweep()` resets `processing` rows older than 2 minutes to `pending` and drains their partitions.

Alternatives: Postgres advisory locks per partition (also correct, but locks tied to a pooled connection are easy to leak in serverless); an external queue such as QStash (more moving parts and another account for a demo).

### Sweep without a frequent cron

Vercel's Hobby plan allows only a daily cron, so stuck events are swept opportunistically on every webhook request and on every `/api/chat` request.
That is enough here, because a stuck event matters only while the customer is still writing.

### Inbound mapping

`button_reply.id` and `list_reply.id` are option ids already.
Plain text that is a number within the last numbered choices maps to that option.
Everything else is free text.
Non-text, non-interactive messages are stored and skipped in this change.

### Outbox

Before sending, insert the outbound message with a random `client_nonce` and `external_id = null`; after the SDK returns, set `external_id`.
This is the base that add-human-handoff needs to tell our sends from inbox replies.

## Risks / Trade-offs

- [`after()` work is cut off when the function times out] → Each turn is a few seconds; the sweep recovers anything cut off.
- [The sweep only runs when a request arrives, so a stuck event waits if nobody writes] → The stuck customer's next message drains their own partition; if the real-phone tests show stuck events anyway, add an external per-minute scheduler (QStash schedule) calling a sweep endpoint.
- [Batch envelope differs from the docs] → The spike fixture is the source of truth; the normalizer is unit-tested against it.
- [Interactive sends require an open 24-hour window] → Always true right after an inbound message; add-guards-and-retention handles the rest.
- [Kapso SDK is pre-1.0 (0.4.x)] → Wrap it in the adapter so a breaking change touches one file; pin the exact version.

## Migration Plan

Adds `webhook_events`.
In development the Kapso webhook points at a `cloudflared` tunnel; deploy-and-document repoints it to production.
