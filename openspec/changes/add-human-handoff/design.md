# Design

## Context

Outbound WhatsApp messages are stored before sending with a `client_nonce`, then get their `external_id` (add-whatsapp-channel).
Per the Kapso docs, `message.kapso.origin` is `cloud_api` for anything sent through Kapso's API, which likely includes inbox replies; the spike records whether any field tells them apart.
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

### Gate in the turn runner

The drain handler re-reads the owner inside the claim transaction and skips the turn if it is `human`.
`runTurn` also re-checks the owner just before sending, so a human reply that arrives during a slow turn wins and the agent's reply is dropped (stored as `suppressed`, not sent).

### Human detection

On `message.sent` with direction `outbound`:
1. If the spike found a field that marks inbox sends, use it.
2. Otherwise look up `messages.external_id`.
   Found means ours: done.
3. Not found, and the conversation has an outbound row with `external_id IS NULL` created in the last 30 seconds: defer the event by 5 seconds (`not_before = now() + 5s`, status back to `pending`) and check again, at most 3 times.
4. Still not found: it is a human reply.
   Store it as sender `human` and apply `human_replied`.

The drain claim query adds `AND (not_before IS NULL OR not_before <= now())`.

Alternative: always wait 5 seconds before treating any echo as human.
Simpler, but delays every legitimate takeover and still races under load.

### requestHuman tool

On WhatsApp it applies `customer_requested` and returns a `handoff` reply.
On the web it returns a `link` reply to `https://wa.me/<NEXT_PUBLIC_WHATSAPP_NUMBER>` and leaves ownership alone.
add-cross-channel-linking later adds the code to that link.

### Inbox embed

`scripts/create-inbox-embed.ts` calls `POST /platform/v1/inbox_embeds` once with `scope_type: "phone_number"`, `scope_id` set to the phone number id, and `allowed_origins` set to localhost and the production origin, and writes the returned `embed_url` to a private file for the user to copy into env.
`/staff/page.tsx` is a server component that reads `KAPSO_INBOX_EMBED_URL` and renders the iframe only after the session check.
Revoking is `DELETE /platform/v1/inbox_embeds/:id`.

### Hand back

A server action with a session re-check calls `transition(conv, "handed_back")` and revalidates the list.
No message is sent to the customer; staff can say goodbye in the inbox first.

## Risks / Trade-offs

- [Inbox replies are indistinguishable and the echo comes very late] → The deferral covers 15 seconds; beyond that a late echo of our own send would flip ownership.
  Log every flip with the message id so it is easy to spot, and the hand-back button fixes it in one click.
- [Embed URL leaks] → It only renders server-side behind the staff gate; if it leaks, revoke the embed and create a new one.
- [24-hour inactivity end returns ownership silently] → Intended: a customer coming back the next day gets the agent.

## Migration Plan

Adds `webhook_events.not_before`.
Creates the inbox embed once per environment.
