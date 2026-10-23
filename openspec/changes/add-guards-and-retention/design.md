# Design

## Context

`replyPolicy` exists on the adapter and returns "always allowed" (add-whatsapp-channel).
`conversations.wa_last_inbound_at` is updated on every inbound WhatsApp message.
Vercel's Hobby plan runs crons once a day, which fits retention.
The spike recorded Groq's real daily limit; `GLOBAL_DAILY_TURN_CAP` is set from it.

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

`checkGuards(conv, inbound, now)` returns `run`, `reply(text)` or `silent`, checked in this order: inbound type, owner (from add-human-handoff), global cap, per-contact limits.
The window check lives in `replyPolicy`, at send time, because the turn may finish later than it started.

### Counting turns

A `turns(id, contact_id, conversation_id, created_at, model, input_tokens, output_tokens)` row is written for each model call.
Limits count rows with indexed queries (`contact_id, created_at`); the global cap counts today's rows.
A `limit_notified_at` on the contact stores when the last limit reply went out, so the reply goes once per window.
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
