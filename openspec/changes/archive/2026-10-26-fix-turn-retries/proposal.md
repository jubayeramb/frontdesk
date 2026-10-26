# Proposal

## Why

The real-phone test of add-guards-and-retention showed two ways a WhatsApp message can go unanswered.
When a turn failed after the customer's message was stored, the retry found the message, took it as answered, and skipped it.
And after any failure the customer's queue waited for the next webhook or chat request, so 25 queued messages sat still until a web visitor happened to write.

## What Changes

- A retried `message.received` finishes what the first attempt started: it runs the turn for the stored message if no reply was stored, and sends stored replies that never went out.
  The guards run again, so a conversation a person owns or a contact already told about a limit still gets no reply.
- A failed event is retried by the same worker after a short wait (5 seconds, then 10), instead of waiting for the next request.
  After its last attempt it is marked failed and the customer's later events go on.

Out of scope: a reply to the customer when an event fails for good, and a scheduled sweep (the Hobby plan runs crons once a day).

Phase 8 follow-up.
Depends on add-guards-and-retention.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `webhook-ingestion`: failed events are retried promptly by the same worker, and a retry finishes an interrupted turn instead of skipping it.

## Impact

- `src/lib/webhooks/events.ts` (`drain`, `finish`), `src/lib/webhooks/kapso-handler.ts` (`received`), `src/lib/agent/run-turn.ts` (a turn for an already stored message).
- No schema change.
