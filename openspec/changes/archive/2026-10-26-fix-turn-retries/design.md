# Design

## Context

`received()` returns early when a message with the event's WhatsApp id is stored, so a redelivered event never answers twice.
`runTurn` stores the inbound message before it calls the model, so a turn that throws leaves a stored message with no reply, and the retry then skips it.
`drain` stops at the first failure and leaves the event pending; only the next webhook or chat request (or its sweep, after 2 minutes) picks it up again.

## Goals / Non-Goals

**Goals:**
- Every stored customer message is answered once, or deliberately left unanswered by a guard.
- A failure delays a customer's queue by seconds, not until the next request.

**Non-Goals:**
- Telling the customer when an event fails for good.
- A scheduled sweep.

## Decisions

### What a retry does with a stored message

The handler looks at what follows the stored message, up to the customer's next message:
- No outbound message: the first attempt died before replies were stored, so the turn runs for the stored message without storing it again.
- Replies that were never attempted (`delivery_status` is null): they are delivered.
- Anything else (sent, failed, suppressed, blocked replies): the turn finished, and nothing happens.

Events for one customer run in order, so no later customer message exists while an earlier event is still being retried.
Running the guards again is safe: an owner change or a limit already told gives `silent` again, and a refused turn writes no `turns` row.

Alternative: store the inbound message and the turn's outcome in one transaction.
The model call sits between them, so this would hold a transaction open for seconds.

### Retrying in the same worker

On a failure, `finish` sets `not_before` to 5 seconds times the attempts so far, and `drain` carries on: its existing wait (up to 15 seconds) covers the backoff, so the same worker retries.
The third failure marks the event failed, and the loop moves on to the customer's next event.

## Risks / Trade-offs

- [A failure that repeats quickly, such as a bad payload, costs three attempts in about 15 seconds] → Three attempts were already the limit; they now happen sooner.
- [A drain can run longer than before] → The route's 60 second limit still applies; a worker cut off mid-event leaves it `processing`, and the existing stale release returns it after 2 minutes.
