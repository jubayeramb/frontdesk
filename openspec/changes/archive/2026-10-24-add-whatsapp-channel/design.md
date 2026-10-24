# Design

## Context

The agent core returns `AgentReply[]` and persists messages (add-agent-core).
Fixtures for every event live in `test/fixtures/kapso/`, re-signed with the secret `test-webhook-secret` (see the fixture README).
The spike's findings that shape this design: one `X-Idempotency-Key` covers a whole batch, WhatsApp timestamps have one-second resolution, enabling buffering on an existing webhook does not take effect, and Kapso rejects free-form sends outside the 24-hour window with a 422.

## Goals / Non-Goals

**Goals:**
- Correct under at-least-once delivery, concurrency, and serverless instances that die after the response.
- The adapter is the only module that calls Kapso's send API.

**Non-Goals:**
- A general job queue.
  One table and one claim query cover this load.
- WhatsApp Flows.
  Buttons and lists are enough for tours and departures.

## Decisions

### Adapter interface

```ts
interface ChannelAdapter {
  channel: "web" | "whatsapp";
  capabilities(): { buttons: number; listRows: number; markdown: boolean };
  replyPolicy(conv: Conversation, now: Date): { canSendFreeForm: boolean; reason?: string };
  render(reply: AgentReply): OutboundMessage[];
  send(to: string, msg: OutboundMessage, opts: { nonce: string }): Promise<SendResult>;
}
```

`send` takes one message, so the outbox can store a row before each send and update it right after.
`deliverTurn` (in `src/lib/channels/deliver.ts`) drives it: `runTurn` returns the stored message id for each reply, the reply is rendered, and each part is sent in order.
A reply that renders into several messages (a split long text) gets one extra row per part, with `payload.continues` pointing at the reply's row; history skips those rows, so the model sees the reply once.
A rejected send marks its row failed and the turn's remaining replies `skipped`, since they would read wrong on their own.

`render` is pure and holds all degradation rules, so the rendering spec is unit-tested without the network.
`replyPolicy` returns "always allowed" here; add-guards-and-retention fills in the 24-hour rule.
The last numbered `choices` payload is stored on the outbound message, so a later "7" can be resolved against it.

### Pipeline

1. `route.ts` reads `await req.text()`, verifies `X-Webhook-Signature` (64 hex chars, `timingSafeEqual` on the HMAC-SHA256 of the raw body).
2. Normalize to a list of events: a batch envelope becomes many, a single payload becomes one.
   A delivery with top-level `"test": true` (Kapso's test button and test API) is acknowledged and dropped. Its sender is our own business number, so processing it would make the agent message itself.
3. Insert each into `webhook_events(dedupe_key unique, partition_key, event_type, payload, status, attempts, error, created_at)` with `ON CONFLICT DO NOTHING`.
   `dedupe_key` is `event_type + ":" + message.id` (conversation id for conversation events).
   The idempotency header is not enough on its own, because a batch shares one key across all its events.
   Events are ordered by arrival (`created_at, id`), never by WhatsApp's timestamp, which has one-second resolution.
   `partition_key` is the customer's WhatsApp number.
4. Return 200, and schedule `drain(partitionKey)` with `after()` for each partition touched, plus one `sweep()`.

### Claim and drain

One claim transaction per event:

```sql
SELECT pg_advisory_xact_lock(hashtextextended($1, 0));
-- release this partition's stale processing rows (pending, or failed at 3 attempts)
SELECT 1 FROM webhook_events WHERE partition_key = $1 AND status = 'processing';  -- busy: stop
SELECT id FROM webhook_events WHERE partition_key = $1 AND status = 'pending'
ORDER BY created_at, id LIMIT 1;
UPDATE webhook_events SET status = 'processing', attempts = attempts + 1, updated_at = now() WHERE id = ...;
```

The turn runs outside the transaction, and the event ends `done`, or back to `pending` with its error (`failed` once attempts reach 3).
Attempts count claims, so an event whose worker keeps dying also ends `failed`.
A drain stops at the first failure: the event stays first in line, so nothing behind it runs out of order, and a sweep retries it after 2 minutes.
`sweep()` releases stale `processing` rows everywhere and drains every partition with a pending event that has waited past 2 minutes.

The first draft used `FOR UPDATE SKIP LOCKED` with a `NOT EXISTS (processing)` check.
That lets two workers start at once: neither sees the other's uncommitted `processing` row, so the second skips the locked first event and takes the second.
The integration test with eight concurrent drains caught it in 2 of 3 runs.
A transaction-scoped advisory lock makes the check and the claim one step, and it is released at commit, so it cannot leak on a pooled connection the way a session lock can.
An external queue such as QStash would also work, with more moving parts and another account for a demo.

### Sweep without a frequent cron

Vercel's Hobby plan allows only a daily cron, so stuck events are swept opportunistically on every webhook request and on every `/api/chat` request.
That is enough here, because a stuck event matters only while the customer is still writing.

### Inbound mapping

`button_reply.id` and `list_reply.id` are option ids already, and their `context.id` names the message that carried the options.
Plain text that is a number within the last numbered choices maps to that option.
Everything else is free text.
Non-text, non-interactive messages are stored and skipped in this change.

### Retries never answer twice

The inbound message is stored with its WhatsApp id, which is unique.
A retried `message.received` whose message is already stored is marked done without a turn.
The trade-off: if a worker dies after storing the message but before sending the reply, the customer gets no reply rather than a second one.

### Outbox

Before sending, mark the outbound message `pending` with a random `client_nonce` and `external_id = null`; after the SDK returns, set `external_id` and `sent`, or `failed` with the error code.
The nonce also goes out as `biz_opaque_callback_data`, which Meta echoes on status webhooks.
This is the base that add-human-handoff needs to tell our sends from inbox replies.

## Risks / Trade-offs

- [`after()` work is cut off when the function times out] → Each turn is a few seconds; the sweep recovers anything cut off.
- [The sweep only runs when a request arrives, so a stuck event waits if nobody writes] → The stuck customer's next message drains their own partition; if the real-phone tests show stuck events anyway, add an external per-minute scheduler (QStash schedule) calling a sweep endpoint.
- [Batch envelope differs from the docs] → The spike fixture is the source of truth; the normalizer is unit-tested against it.
- [Buffering is turned on later and silently ignored] → Leave buffering off; per-customer ordering already handles rapid messages. If it is ever wanted, create a new webhook with buffering on instead of updating the old one.
- [Logs leak phone numbers through message ids] → `wamid` ids embed the phone number in base64, so log masking treats message ids like phone numbers.
- [Interactive sends require an open 24-hour window] → Always true right after an inbound message; add-guards-and-retention handles the rest.
- [Kapso SDK is pre-1.0 (0.4.x)] → Wrap it in the adapter so a breaking change touches one file; pin the exact version.

## Real-phone findings (2026-10-24)

The first run (quote, departures, tap, booking TR-00001) worked end to end: every inbound and outbound message was stored with its WhatsApp id, and Kapso's `sent` and `read` events were stored and marked done.
Three things looked wrong on the phone and are fixed:

- **Stray tour buttons after a quote.** The model called `listTours` to match "Sundarban" to a tour, then `getQuote`, and the turn sent the quote plus "Which tour would you like?" with three buttons. A successful quote or booking now clears options collected earlier in the turn.
- **Departures listed in text above the same buttons.** The prompt now says to introduce options in one short sentence and never list them, and the `listTours` and `listDepartures` results repeat it, since the model lists options right after receiving them.
- **Run-on replies.** After a tool result, `gpt-oss-120b` on Groq often keeps writing closing lines ("Which date works best for you?Let me know which departure..."), up to a dozen, with no space between them. It reproduced in 3 of 3 replays and still happens, shorter, with the new prompt. `firstMessage` keeps the text up to the first sentence end followed straight by a capital letter.

Not a bug: with 48 hours' notice and a 14-day window, a tour has 3 or 4 departures, so departures arrive as buttons or a short list depending on the day.
Webhook responses took about 1.1 s from a laptop in Dhaka even for events that store nothing.
That is Neon's WebSocket pool reconnecting after its 10 second idle timeout, several round trips to us-east; back-to-back requests took about 275 ms.
On Vercel next to the database it should not matter, and deploy-and-document should measure it there.

## Migration Plan

Adds `webhook_events`.
In development the Kapso webhook points at a `cloudflared` tunnel; deploy-and-document repoints it to production.
