# Proposal

## Why

WhatsApp is the channel that makes this demo real: anyone can message the number and get a working front desk.
Kapso delivers webhooks at least once, retries on slow responses, and can batch messages, so the pipeline has to be correct under duplicates and concurrency before any customer touches it.

## What Changes

- Add the channel adapter interface (`capabilities`, `replyPolicy`, `render`, `send`) shared by every channel.
- Add the WhatsApp adapter: `choices` become reply buttons (3 or fewer), a list (up to 10) or numbered text (more than 10); markdown is stripped; labels are cut to WhatsApp's limits; sends go through the Kapso SDK.
- Add `POST /api/webhooks/kapso`: verify the signature on the raw body, store each event once, return 200 fast, and process events in order per conversation after the response.
- Handle `whatsapp.message.received` (run a turn) and `whatsapp.message.failed` (mark the message failed).
  Map button and list replies back to option ids, and numbered text replies to the matching option.
- Store every outbound message before sending, and fill in its WhatsApp id after.
- Test end to end with a real phone.

Out of scope: owner checks, human detection and `conversation.ended` (add-human-handoff), the 24-hour window, rate limits and media replies (add-guards-and-retention).
Until then, non-text messages are stored and skipped.

Phase 4.
Depends on add-agent-core and on spike-kapso-and-groq for fixtures and the confirmed envelope and dedupe facts.

## Capabilities

### New Capabilities

- `whatsapp-channel`: how agent replies are rendered and sent on WhatsApp, and how interactive replies map back to options.
- `webhook-ingestion`: how Kapso webhooks are verified, deduplicated, acknowledged and processed in order.

### Modified Capabilities

None.

## Impact

- New dependency: `@kapso/whatsapp-cloud-api`.
- New: `src/lib/channels/`, `src/lib/webhooks/`, `src/app/api/webhooks/kapso/route.ts`, `webhook_events` table.
- New env vars: `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`, `KAPSO_WEBHOOK_SECRET`.
- External: the Kapso webhook points at a tunnel in development and at production in deploy-and-document.
