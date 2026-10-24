# Proposal

## Why

A turn takes 6 to 9 seconds on Groq, and on WhatsApp the customer sees nothing until the reply lands.
The web widget already shows a typing indicator at once.
WhatsApp has its own: marking the customer's message as read can show "typing…" until the reply is sent.

## What Changes

- When the agent is about to answer a WhatsApp message, mark that message as read and show the typing indicator.
- It runs alongside the turn, never delays it, and a failure to show it never stops the reply.
- Messages the agent skips (images, reactions) get neither.

Out of scope: making turns faster (deploy-and-document looks at Groq and Neon latency), and skipping the indicator while a person owns the conversation (add-human-handoff, which adds ownership checks before any turn).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `whatsapp-channel`: adds the typing indicator while the agent works on a reply.

## Impact

- `ChannelAdapter` gets an optional `showTyping(inboundExternalId)`; the WhatsApp adapter implements it with the SDK's `markRead` and `typingIndicator`.
- `src/lib/webhooks/kapso-handler.ts` calls it before `runTurn`.
- `test/support/fake-kapso.ts` tells read receipts apart from sends.
