# Proposal

## Why

A front desk that can never reach a person is a dead end, and an agent that keeps talking over a person is worse.
Ownership has to be explicit, stored, and respected by every code path that could reply.

## What Changes

- Add ownership to the behavior: each conversation is owned by `ai` or `human`, and the agent never replies while a human owns it.
- Add the `requestHuman` tool.
  On WhatsApp it flips ownership to human and tells the customer a person will reply.
  On the web it offers a WhatsApp link instead, because people only reply on WhatsApp.
- Hand off requests to change or cancel a booking the same way: the agent cannot change bookings, and must not offer a second booking in place of a change.
- Detect human replies: an outbound `whatsapp.message.sent` that we did not send is a reply from Kapso's inbox.
  Store it as sent by `human` and flip ownership to human.
- Hand back: a "Hand back to AI" button on `/staff`, or `whatsapp.conversation.ended` from Kapso, returns the conversation to the agent.
- Add `/staff` with Kapso's embedded inbox and a conversation list showing owner, channel and last message.

Out of scope: linking the web conversation to WhatsApp with a code and the `/c` timeline (add-cross-channel-linking).
Until then the web link opens a fresh WhatsApp chat.

Phase 6.
Depends on add-whatsapp-channel (outbox and webhook pipeline), add-web-chat, and add-pricing-and-booking-data (staff gate).

## Capabilities

### New Capabilities

- `human-handoff`: conversation ownership, how it changes, and how the agent behaves under each owner.
- `staff-inbox`: the staff page where people read and answer WhatsApp conversations and hand them back.

### Modified Capabilities

None.

## Impact

- New: `src/lib/ownership.ts`, `requestHuman` tool, `message.sent` and `conversation.ended` handlers, `src/app/staff/page.tsx`, `scripts/create-inbox-embed.ts`.
- `webhook_events` gains `not_before` for deferred re-checks.
- New env vars: `KAPSO_INBOX_EMBED_URL` (secret, holds a token), `NEXT_PUBLIC_WHATSAPP_NUMBER`.
- External: one Kapso inbox embed scoped to the demo phone number.
