# Proposal

## Why

Web chat and WhatsApp need the same agent with the same memory and the same rules.
If the agent knew which transport it was on, every channel would grow its own copy of the logic, so the core is built first, with no channel attached, and tested on its own.

## What Changes

- Add the conversation store: `contacts`, `channel_identities`, `conversations` and `messages`, with every message tagged by channel.
- Add `runTurn({ conversationId, inbound })`, which loads recent history plus a short state summary, calls the model with tools, and returns a list of channel-neutral replies (`text`, `choices`, `handoff`, `link`).
- Add tools: `listTours`, `getQuote`, `listDepartures`, `bookDeparture`.
  Tools return data; a presenter turns tool results into `choices` replies, so options and prices always come from the database.
- Add a scoped system prompt: Triplone Tours only, unrelated requests are refused.
- Add the model module: primary and fallback Groq models, fallback on rate limits and server errors, and a fixed "busy" reply when both fail.
- Add a local `pnpm agent:chat` REPL to talk to the agent without any channel.
- Add the foreign key from `bookings.conversation_id` to `conversations`.

Out of scope: channel adapters, rendering and sending (add-whatsapp-channel, add-web-chat), `requestHuman` (add-human-handoff), `continueOnWhatsApp` (add-cross-channel-linking), rate limits (add-guards-and-retention).

Phase 3.
Depends on add-pricing-and-booking-data, and on spike-kapso-and-groq for the confirmed model ids and limits.

## Capabilities

### New Capabilities

- `front-desk-agent`: how the agent answers a customer turn: tools, grounded prices and options, scope, model fallback, and reply kinds.
- `conversation-history`: how contacts, conversations and messages are stored across channels and what history the agent sees.

### Modified Capabilities

None.

## Impact

- New dependencies: `ai`, `@ai-sdk/groq`.
- New: `src/lib/agent/`, conversation tables and migration, `scripts/agent-chat.ts`.
- New env var: `GROQ_API_KEY`.
