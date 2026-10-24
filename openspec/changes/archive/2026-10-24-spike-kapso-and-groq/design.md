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

Captured on 2026-10-24 against the dedicated number (+1 205-813-8571, `phone_number_id` 1382322134966757) with a phone-number webhook on payload v2.
Fixtures are in `test/fixtures/kapso/`.

| Question | Answer | Evidence |
|---|---|---|
| Signature scheme matches the docs | Yes. `X-Webhook-Signature` is HMAC-SHA256 of the raw body as 64-char lowercase hex, with no `sha256=` prefix. A re-serialized body does not verify. | 30 of 30 captures verified with the webhook secret. |
| What `X-Idempotency-Key` is derived from, and whether it is stable across retries | Stable across retries and unique per delivery, but not a hash of the body. A batch carries one key for all its events. | A 500 on `conversation.created` was retried after 10.8s with the same key and a byte-identical body. 20 captures had 19 unique keys, the duplicate being that retry. |
| Inbox reply distinguishable from an API send | No. The webhook payloads differ only in content, ids and timestamps, with no header differences. `kapso whatsapp messages get` returns identical metadata for both. | Diff of `message-sent-api-text` against `message-sent-inbox-reply`. |
| Buffering default for `message.received` | Created explicitly with buffering off, so the default was not observed. Enabling buffering later with `webhooks update` is saved but not applied: Kapso reports `buffer_enabled: true` and still delivers one event at a time. A webhook created with buffering on batches correctly. | Two rounds of three quick messages after the update arrived unbatched, 36 seconds and 5 minutes after it. A second webhook created with buffering batched the next three into one delivery. |
| Batched envelope shape | `{ type, batch: true, data: [<full single payload>, ...], batch_info: { size, window_ms, first_sequence, last_sequence, conversation_id } }` with headers `X-Webhook-Batch: true` and `X-Batch-Size`. Delivered about 6 seconds after the first message on a 5 second window. | `message-received-batch` |
| `conversation.ended` triggers observed | Manual end from the inbox. The payload has no field saying why the conversation ended. Inactivity end was not observed. | `conversation-ended` |
| Primary model completes multi-step tool calls | Yes, `openai/gpt-oss-120b`, 3 of 4 runs correct. One run passed bathrooms as 2 instead of 3, subtracting the included bathroom itself, so the tool subtracted it twice and the total came out wrong. | Throwaway `scripts/spike/groq-tools.mts` runs (deleted after the spike), about 1.3K to 1.5K tokens and 1.6 to 3.1s per 3-step turn. |
| Fallback model completes multi-step tool calls | The planned `llama-3.3-70b-versatile` no longer exists on Groq. `openai/gpt-oss-20b` passed 3 of 3 (about 1.3K to 1.5K tokens, 1.7 to 1.9s). `qwen/qwen3.8-27b` passed 3 of 3 (about 2K tokens, 0.8s). | Groq `/openai/v1/models` and the same script. |
| Groq free-tier limits on the day (RPM, TPM, RPD) | Per model: 1,000 requests a day and 8,000 tokens a minute. With 3 requests and about 1.4K tokens per turn, that is about 330 turns a day and about 5 turns a minute per model. | `x-ratelimit-*` response headers. |

### Other findings

- **`message.kapso.origin` is `cloud_api` for inbound messages too**, so it says nothing about direction or sender.
- **`wamid` ids embed the customer's phone number in base64.** Logs and fixtures that hide phone numbers must hide message ids too.
- **Button and list replies carry `context.id`**, the id of the message that held the options. Plain text replies do not.
- **Payloads carry Meta's business-scoped user id and username** (`from_user_id`, `business_scoped_user_id`, `username`) next to the phone number.
- **WhatsApp timestamps have one-second resolution.** Three messages sent within a second shared a timestamp, and Kapso's inbox showed them as B, A, C while the webhooks arrived as A, B, C.
- **Kapso enforces the 24-hour window itself.** A free-form send outside it fails synchronously with `422 Cannot send non-template messages outside the 24-hour window`.
- **`whatsapp.message.failed` was not captured.** The project has no approved template to send to an unreachable number, and the window check returns a 422 before anything reaches Meta.
- **`whatsapp.thread.ownership_changed` did not fire on an inbox reply.** It belongs to Meta's thread control (`kapso whatsapp threads take|pass|release`), not to the inbox.
- **The dedicated number is `LIMITED`** until Meta approves its display name, and its verified name is "Triplone". Replies to customers who write first still went out.
- **The health check fails on the sandbox number** with Meta token and app id errors, so the sandbox cannot stand in for a real number.
- **Kapso test deliveries carry top-level `"test": true`** and an idempotency key prefixed `test-`, are signed with the real secret, and come "from" the business number itself.
- **CLI details:** the create command is `kapso whatsapp webhooks new`, not `create`, and `--secret-key` lets us generate and own the webhook secret instead of capturing a one-time value.
- **Repo detail, not Kapso:** without `"type": "module"`, `tsx` compiles `.ts` scripts to CommonJS, where top-level await fails. Scripts need `.mts` or a module package type.

## Impact on later changes

- **add-whatsapp-channel:** the dedupe key is `event_type:message.id` (conversation id for conversation events), never the idempotency header alone, because a batch shares one key. Order by arrival (`created_at, id`), never by WhatsApp timestamp. Drop deliveries with `"test": true`. Leave buffering off; per-customer ordering already covers rapid messages, and enabling it later does not take effect. Map Kapso's 422 window error to a blocked send. Fixture redaction and log masking cover `wamid` ids.
- **add-human-handoff:** drop the "origin or marker field" step. An unknown outbound id after the deferral window is the only human signal.
- **add-agent-core:** primary `openai/gpt-oss-120b`, fallback `openai/gpt-oss-20b` (same model family and prompt format). Tools take the customer's raw inputs and do every calculation in code. Budget about 1.5K tokens per turn.
- **add-guards-and-retention:** set `GLOBAL_DAILY_TURN_CAP` to 250 (about 75% of one model's daily requests). The 8,000 tokens a minute limit is the tighter one; the busy reply covers bursts.
- **add-pricing-and-booking-data:** write scripts that use top-level await (the seed) as `.mts`, or switch the package to `"type": "module"`.
- **deploy-and-document:** the display name needs Meta's approval before launch, and "Triplone" needs confirming or changing.
