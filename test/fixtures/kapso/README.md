# Kapso webhook fixtures

Real Kapso webhook deliveries (payload v2), captured on 2026-10-24 from the demo number and a test phone.

Each file is `{ description, capturedAt, headers, body }`.
`body` is the exact raw request body as a string, so signature checks run on the same bytes Kapso sent.

## Customers known only by user id

`message-received-text-user-id.json` and `conversation-created-user-id.json` come from production on 2026-10-27, from a customer Meta reports by business-scoped user id only.
They have no `message.from` and no `conversation.phone_number`.
They were taken from Kapso's delivery log, which keeps only some fields (no `kapso` blocks and no `message.from_user_id`), so the body is the logged shape, not the exact bytes Kapso sent.
The message's sender fields (`from: null`, `from_user_id`, `username`, `from_parent_user_id: null`, `context: null`) are filled in from Kapso's stored copy of the same message, since the log leaves them out and production failed on `from: null`.
The user id is replaced with `BD.1000000000000002`, including inside the `wamid`, and the username with `testcustomer2`.

## Redaction

- The test phone is replaced with `8801700000000`, including inside `wamid` ids, which embed the phone number in base64.
- The contact name, username, business-scoped user id and media links are replaced with placeholders.
- The demo business number (`12058138571`) is kept, since it is public.

## Signatures

Redaction changes the body, so every fixture is re-signed.
`x-webhook-signature` is `HMAC-SHA256("test-webhook-secret", body)` as lowercase hex.
Tests that verify signatures must use that secret.

## Not captured

- `whatsapp.message.failed`: the project had no approved template to send to an unreachable number, and Kapso rejects free-form sends outside the 24-hour window synchronously with a 422 instead of emitting the event.
