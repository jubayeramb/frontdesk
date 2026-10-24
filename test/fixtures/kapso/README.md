# Kapso webhook fixtures

Real Kapso webhook deliveries (payload v2), captured on 2026-10-24 from the demo number and a test phone.

Each file is `{ description, capturedAt, headers, body }`.
`body` is the exact raw request body as a string, so signature checks run on the same bytes Kapso sent.

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
