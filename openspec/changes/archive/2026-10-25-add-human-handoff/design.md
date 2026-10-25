# Design

## Context

Outbound WhatsApp messages are stored before sending with a `client_nonce`, then get their `external_id` (add-whatsapp-channel).
The spike confirmed that an inbox reply is identical to an API send in the webhook and in Kapso's message API: same `origin` (`cloud_api`, which inbound messages also carry), same fields, same headers.
Matching message ids is the only way to tell them apart.
Kapso ends a conversation on agent action, manual closure, or 24 hours of inactivity.

## Goals / Non-Goals

**Goals:**
- One function owns every ownership transition, so the rules live in one place and are unit-tested as a state machine.
- No race lets the agent reply after a human took over.

**Non-Goals:**
- Notifying staff by email or push when a handoff happens.
  They watch the inbox.
- Per-staff assignment.

## Decisions

### State machine

`transition(conv, event)` in `src/lib/ownership.ts` with events `customer_requested`, `human_replied`, `handed_back`, `conversation_ended`.
`ai` + `customer_requested` or `human_replied` → `human`; `human` + `handed_back` or `conversation_ended` → `ai`; anything else is a no-op.
It writes the owner, `owner_changed_at`, and a system message in one transaction.
An optional `because` replaces the event's stock reason, so `requestHuman` can record "the customer asked to cancel a booking"; the text also goes in the note's payload for the staff list.

### Gate in the turn runner

The drain handler re-reads the owner inside the claim transaction and skips the turn if it is `human`.
`runTurn` also re-checks the owner just before sending, so a human reply that arrives during a slow turn wins and the agent's reply is dropped (stored as `suppressed`, not sent).

### Human detection

On `message.sent` with direction `outbound`:
1. Look up `messages.external_id`.
   Found means ours: done.
2. Not found, and the conversation has an outbound row with `external_id IS NULL` created in the last 30 seconds: defer the event by 5 seconds (`not_before = now() + 5s`, status back to `pending`) and check again, at most 3 times.
3. Still not found: it is a human reply.
   Store it as sender `human` and apply `human_replied`.

The drain claim query adds `AND (not_before IS NULL OR not_before <= now())`.
A deferred event also holds back the customer's later events, so nothing overtakes it.
When the only work left is a deferred head due within 15 seconds, the drain waits for it in place instead of ending, because no new webhook may arrive to start another drain.
Kapso's `message.sent` does not echo `biz_opaque_callback_data`, so the nonce cannot match an echo; the message id is the only link.

Alternative: always wait 5 seconds before treating any echo as human.
Simpler, but delays every legitimate takeover and still races under load.

### requestHuman tool

On WhatsApp it applies `customer_requested` and returns a `handoff` reply.
On the web it returns a `link` reply to `https://wa.me/<NEXT_PUBLIC_WHATSAPP_NUMBER>` and leaves ownership alone.
add-cross-channel-linking later adds the code to that link.

### Read receipts and typing

Every customer message is marked read on arrival.
The typing indicator rides on the same call and is added only while the agent owns the conversation.

### Inbox embed

`scripts/create-inbox-embed.ts` calls `POST /platform/v1/inbox_embeds` once with `scope_type: "phone_number"`, `scope_id` set to the phone number id, and `allowed_origins` set to localhost and the production origin, and writes the returned `embed_url` to a private file for the user to copy into env.
`/staff/page.tsx` is a server component that reads `KAPSO_INBOX_EMBED_URL` and renders the iframe only after the session check.
The variable is optional: without it `/staff` shows how to create the embed.
Next to the iframe, the page lists only the conversations a person owns, with the reason and a hand-back button; Kapso's inbox already lists the rest.
A client component calls `router.refresh()` every 5 seconds while the tab is visible, which re-renders the list without reloading the iframe.
Revoking is `DELETE /platform/v1/inbox_embeds/:id`.

### Hand back

A server action with a session re-check calls `transition(conv, "handed_back")` and revalidates the list.
No message is sent to the customer; staff can say goodbye in the inbox first.

## Risks / Trade-offs

- [Inbox replies are indistinguishable and the echo comes very late] → The deferral covers 15 seconds; beyond that a late echo of our own send would flip ownership.
  Log every flip with the message id so it is easy to spot, and the hand-back button fixes it in one click.
- [Embed URL leaks] → It only renders server-side behind the staff gate; if it leaks, revoke the embed and create a new one.
- [Kapso ends conversations after its inactivity timeout] → The webhook reports `inactivity_minutes: 60`, so a quiet conversation may return to the agent after an hour, not 24 hours.
  Intended either way: a customer coming back later gets the agent; staff can take it over again by replying.
- [Blue ticks before a person reads] → Messages are marked read on arrival even while a person owns the conversation, so the customer may see ticks before staff open it.
  It matches the agent's behavior and keeps the ticks from looking broken.
- [Meta can disable a new business number] → The first number was disabled during testing; the phone checks ran on Kapso's sandbox number, which only reaches phones that joined it.

## Migration Plan

Adds `webhook_events.not_before`.
Creates the inbox embed once per environment.
