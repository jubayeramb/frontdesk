# Tasks

## 1. Fixtures

- [x] 1.1 Save the production deliveries for a customer known only by user id (`message.received` text, `conversation.created`), redacted and re-signed like the others, and note them in the fixtures README

## 2. Ingestion

- [x] 2.1 Add `customerOf` to the normalizer and key events by user id or phone number, and verify the new fixtures normalize to events instead of "cannot key"
- [x] 2.2 Let `findOrCreateConversation` and `findConversation` take several ids, attaching every id to one contact, and verify with integration tests for a phone, a user id, both, and a phone already on another contact

## 3. Handler and sends

- [x] 3.1 Use the customer's ids for received, sent and ended events and for link codes, and verify with integration tests that a user-id-only customer gets a reply, an inbox reply takes over, an ended conversation is handed back, and a code links
- [x] 3.2 Send to a user id with `recipient` and to a phone number with `to`, and verify the request bodies in the adapter tests
- [x] 3.3 Mask only phone identities in `/c` and `/staff`, and verify both views for a user-id-only contact

## 4. Ship

- [x] 4.1 Run lint, typecheck, unit, integration and e2e tests, and verify they pass
- [ ] 4.2 Deploy, message the Triplone number from the user-id-only account, and verify the agent replies and a link code continues a web conversation
