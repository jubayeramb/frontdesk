# Design

## Context

`replyPolicy` exists on the adapter and returns "always allowed" (add-whatsapp-channel).
`conversations.wa_last_inbound_at` is updated on every inbound WhatsApp message.
Vercel's Hobby plan runs crons once a day, which fits retention.
The spike recorded 1,000 requests a day per model and about 3 requests per turn, so `GLOBAL_DAILY_TURN_CAP` defaults to 250.
The 8,000 tokens a minute limit is tighter in bursts; the model fallback and the busy reply cover it.

## Goals / Non-Goals

**Goals:**
- Every guard runs before the model, in one function the drain handler and `/api/chat` both call.

**Non-Goals:**
- Sending templates to reopen a closed window.
  The demo only replies to customers who just wrote.
- IP rate limiting on `/api/chat`.
  Per-contact limits plus the global cap bound the cost; a new cookie per request only spends the global cap.

## Decisions

### Guard order

Silent messages (reactions, statuses) are dropped by the drain handler before anything is stored.
`checkGuards(conv, inbound, now)` then returns `run`, `reply(text)` or `silent`, checked in this order: owner (from add-human-handoff), unsupported type, global cap, per-contact limits.
The owner goes before the unsupported type because the person sees a photo in Kapso's inbox; a fixed "text only" reply from the agent there would be wrong.
`runTurn` calls `checkGuards` right after storing the inbound message, so the drain handler and `/api/chat` share it without either calling it directly.
The window check lives in `replyPolicy`, at send time, because the turn may finish later than it started.

### Counting turns

A `turns(id, contact_id, conversation_id, created_at, model, input_tokens, output_tokens)` row is written for each model call.
Limits count rows with indexed queries (`contact_id, created_at`); the global cap counts today's rows.
A `limit_notified_at` on the contact stores when the last limit reply went out, so the reply goes once per window.
No turn runs while a limit holds, so the latest counted turn marks when the limit was reached: a contact told after that has already heard it.
One conditional update sets the timestamp and decides, so two messages at once still get one reply.
The same table gives per-turn token numbers for the write-up.

Alternative: a counter table with hour and day buckets.
Fewer rows, but rolling windows get awkward and the token data is lost.

### Window display

A pure `windowRemaining(lastInboundAt, now)` feeds both `/c` and `/staff`; the countdown renders client-side and re-renders every minute.

### Retention job

`vercel.json` schedules `GET /api/cron/retention` daily.
The route checks `Authorization: Bearer ${CRON_SECRET}` (Vercel sends it), then deletes in one transaction with `ON DELETE CASCADE` from `conversations` down, followed by orphaned identities and contacts and old webhook events.
It logs counts only.

## Risks / Trade-offs

- [One person can clear cookies to reset their web limits] → The global cap still bounds the day's spend, and WhatsApp limits are tied to the phone number.
- [Kapso keeps its own copy of WhatsApp messages] → The privacy note and README say so plainly; the inbox data is outside this app's retention.
- [Cron misses a day] → The next run catches up, since the cutoff is relative.

## Migration Plan

Adds `turns`, `contacts.limit_notified_at`, and cascade foreign keys.
Set `CRON_SECRET` in Vercel before the first scheduled run.
