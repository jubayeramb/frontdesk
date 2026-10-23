# Design

## Context

What the Kapso skill docs already state (to be confirmed, not assumed):

- Signature: `X-Webhook-Signature` is `HMAC-SHA256(secret, raw body)` as hex.
- Headers: `X-Webhook-Event`, `X-Idempotency-Key`, `X-Webhook-Payload-Version`, and `X-Webhook-Batch` plus `X-Batch-Size` on batches.
- Delivery: must return 200 within 10 seconds, retried at 10s, 40s and 90s.
- `message.kapso.origin` has three documented values: `cloud_api`, `business_app`, `history_sync`.
  The embedded inbox sends through Kapso's API, so its replies may well arrive as `cloud_api`, the same as ours.
- `conversation.ended` fires on agent action, manual closure, or 24 hours of inactivity.
- Buffering is a per-webhook setting (`buffer_enabled`, 1-60 second window).

Groq numbers in circulation disagree (1,000 vs 14,400 requests a day on the free tier).

## Goals / Non-Goals

**Goals:**
- A fixture for every event the pipeline will handle, captured from real traffic.
- A yes or no on each open question below, with the evidence.

**Non-Goals:**
- No production code, schema, or tests beyond what the capture needs.
- No load testing of Groq.

## Decisions

- **Capture with a tiny standalone Node server behind a tunnel, not the Next.js app.** The app has no webhook route yet, and a 30-line `node:http` server that writes `{headers, rawBody}` to a file is easier to trust than a half-built route.
  Alternative: Kapso's test delivery (`scripts/test.js`).
  Useful for the signature check, but it sends synthetic payloads, so it cannot answer the origin question.
- **Tunnel: `cloudflared` quick tunnel.** No account needed and a stable HTTPS URL for the session.
  Alternative: ngrok, which needs an account for a stable URL.
- **Fixtures keep raw bodies byte-for-byte, with secrets out and phone numbers replaced.** Signature tests need the exact bytes, so redaction happens by re-signing: replace the phone number, then recompute the signature with a fixed test secret and store that secret in the test helper.
  Alternative: store unsigned JSON. That loses the ability to test verification against realistic bodies.
- **Groq check runs as a one-off `tsx` script** calling the AI SDK with two dummy tools and a forced two-step task (look up, then compute).
  It records which models complete the loop and the rate-limit headers Groq returns.

## Risks / Trade-offs

- [Inbox replies are indistinguishable by origin] → Human detection relies on "outbound id we did not send".
  Add-whatsapp-channel's outbox (insert with a nonce before sending, store the id after) becomes required, not a fallback.
- [Instant-setup number needs a verification step that blocks] → Fall back to Kapso's sandbox number if offered, and note it.
- [Groq model ids change] → Record the exact ids used on the day; the model module reads them from one place.
- [Captured payloads contain real numbers] → Only the user's own test phone is used, and every fixture is redacted before it is written to the repo.

## Findings

Filled in during apply.

| Question | Answer | Evidence |
|---|---|---|
| Signature scheme matches the docs |  |  |
| What `X-Idempotency-Key` is derived from, and whether it is stable across retries |  |  |
| Inbox reply distinguishable from an API send |  |  |
| Buffering default for `message.received` |  |  |
| Batched envelope shape |  |  |
| `conversation.ended` triggers observed |  |  |
| Primary model completes multi-step tool calls |  |  |
| Fallback model completes multi-step tool calls |  |  |
| Groq free-tier limits on the day (RPM, TPM, RPD) |  |  |

## Impact on later changes

Filled in during apply: one line per finding that changes a later proposal, with the change name.
