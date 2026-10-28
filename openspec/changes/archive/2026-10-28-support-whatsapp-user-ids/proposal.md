# Proposal

## Why

On 2026-10-27 production stopped answering a real customer on WhatsApp.
The customer has a WhatsApp username, and Meta now reports such customers by a business-scoped user id (`BD.…`) instead of a phone number.
Kapso's deliveries for them have no `message.from` and no `conversation.phone_number`, only `conversation.business_scoped_user_id`.
Every part of the WhatsApp path keys the customer by phone number, so the webhook drops these events as "cannot key" and the agent never runs.
Anyone on WhatsApp with a username gets no reply at all.

## What Changes

- Read the customer from every Kapso event as a phone number, a business-scoped user id, or both.
- Queue each customer's events under the user id when there is one, else the phone number.
- Store both as WhatsApp identities of one contact, so customers known by phone keep their conversation when Meta starts sending the user id.
- Send replies to a user id with the SDK's `recipient` field, and to a phone number with `to`.
- Use the WhatsApp username as the contact's name when Kapso sends no profile name.
- Show a masked phone number in `/c` and `/staff` only when there is one, and "WhatsApp" alone otherwise.
- Make inbox replies, conversation-ended hand-back and link codes work for customers known only by user id.
- Add redacted real payloads for a customer known only by user id to `test/fixtures/kapso/`.

Out of scope: `whatsapp.contact.identity_changed` (a user id changing), parent user ids, and sending to a username.
Contacts already split across a phone identity and a user id identity are not merged.

Phase 4, a production fix.
Depends on `add-whatsapp-channel`, `add-human-handoff` and `link-web-to-whatsapp`, all archived.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `webhook-ingestion`: events are keyed per customer by user id or phone number.
- `whatsapp-channel`: replies reach customers known only by user id.
- `conversation-timeline`: the WhatsApp identity is masked as a phone number only when it is one.

## Impact

- `src/lib/webhooks/normalize.ts`, `src/lib/webhooks/kapso-handler.ts`, `src/lib/channels/whatsapp/adapter.ts`, `src/lib/conversations/store.ts`, `src/lib/linking.ts`, `src/lib/web-chat/timeline.ts`, `src/lib/staff/conversations.ts`.
- New fixtures in `test/fixtures/kapso/`.
- No schema change: a user id is stored as another `channel_identities` row.
