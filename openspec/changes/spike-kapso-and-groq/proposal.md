# Proposal

## Why

Every later change depends on facts about Kapso and Groq that the docs leave open or that only show up with real traffic.
Building the webhook pipeline or the agent on guessed payloads would mean rework, so this change gets real payloads and real limits first.

## What Changes

- Create a Kapso account, a project and an instant-setup WhatsApp number with the Kapso CLI.
- Point a phone-number webhook (payload v2) at a local tunnel and capture real payloads into `test/fixtures/kapso/`: `message.received` (text, button reply, list reply, media, reaction), `message.sent` from our API, `message.sent` from an inbox reply, `message.failed` if one can be triggered, `conversation.ended`, and a buffered batch.
- Confirm the signature scheme against the captured raw bodies, and what `X-Idempotency-Key` is derived from.
- Confirm whether an inbox reply is distinguishable from our own API send (`message.kapso.origin` or any other field).
- Confirm whether buffering is on by default for `message.received`, and the exact batched envelope.
- Confirm that a Groq model makes multi-step tool calls through the AI SDK, for both the primary and the fallback model, and record the free-tier limits shown on the day.
- Record every finding in this change's `design.md` and list what it changes in the later proposals.

Out of scope: any application code under `src/`.
The throwaway capture script lives under `scripts/spike/` and is deleted before archive, keeping only the fixtures.

Phase 1.
Depends on nothing.
Every later change depends on it.

## Capabilities

### New Capabilities

None.
This change produces fixtures and findings, not system behavior, so it sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

- New: `test/fixtures/kapso/*.json` (redacted real payloads with headers).
- New env vars in `.env.local` only: `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`, `KAPSO_WEBHOOK_SECRET`, `GROQ_API_KEY`.
- External: a Kapso project, a WhatsApp number, and a Groq API key.
