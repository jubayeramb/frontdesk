# Design

## Context

Kapso's v2 payloads identify the customer in several places: `message.from` on received messages, `message.to` on outbound ones, and `conversation.phone_number` and `conversation.business_scoped_user_id` on all of them.
Since 2026-10-25 every delivery has carried `business_scoped_user_id`.
From 2026-10-27 a customer with a username arrives with the user id only.
Kapso's event reference shows `phone_number` in every example and never says it can be missing.
`@kapso/whatsapp-cloud-api` 0.4.0 accepts `recipient` (a user id) in place of `to` on every send.

## Decisions

### The customer is a phone number, a user id, or both

`customerOf(payload)` returns `{ phone?, userId? }` from `message.from`, `message.to`, `conversation.phone_number` and `conversation.business_scoped_user_id`.
An event with neither is still invalid.

### Queue by user id first

The partition key is the user id when there is one, else the phone digits.
Options:
- User id first (chosen): a customer whose phone disappears keeps the same queue, since the user id was there before and after.
  A customer whose events briefly arrive without a user id would get a second queue for that time; Kapso has sent it on every delivery since 2026-10-25.
- Phone first: matches the old keys, but splits the queue for exactly the customers this change is for.

### Both ids are identities of one contact

A user id is stored as another `channel_identities` row with channel `whatsapp`; it cannot collide with a phone number, since it starts with a country code and a dot.
`findOrCreateConversation` takes a list of ids, finds the contact by the first one stored, and attaches the rest to that contact, moving an id that pointed at another contact.
Options:
- Several identity rows (chosen): no migration, and every lookup by either id works.
- A `business_scoped_user_id` column on the phone identity: one row per customer, but a customer known only by user id has no phone to hang it on.
Moving an id is safe because Meta sent both in one event for one person.
A customer whose phone identity was stored before this change and whose next event has only the user id starts a new contact; the old one ages out with retention.

### The adapter picks `to` or `recipient`

`deliverTurn` still passes one address string.
The address is the phone number when there is one, since that is what every earlier send used, else the user id.
The adapter sends digits with `to` and anything else with `recipient`.

### Masking

`/c` and `/staff` show "•••• 4821" only for a phone identity.
A contact known only by user id shows as "WhatsApp" in `/c`, and by its name (the profile name or username) in `/staff`.
The last digits of a user id mean nothing to a person, so they are never shown.

## Risks

- Sending with `recipient` through Kapso's Meta proxy has not been tried before this change.
  The production check sends a real reply to a user-id-only customer before the change is archived.
