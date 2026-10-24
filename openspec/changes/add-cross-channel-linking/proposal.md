# Proposal

## Why

The demo's best moment is a quote on the website that WhatsApp already knows about.
Without a link between the two, a visitor who moves to WhatsApp starts over, and a web visitor who asks for a person loses everything they told the agent.

## What Changes

- Add one-time link codes (`TR-` plus 6 characters, valid 15 minutes, single use).
- Add the `continueOnWhatsApp` tool (web only): it creates a code and returns a `wa.me` link with "Hi! My code is TR-XXXXXX" prefilled.
- When a WhatsApp message contains a valid code, attach that WhatsApp number to the web visitor's contact and continue the same conversation, quote included.
- `requestHuman` on the web now uses the coded link, so the person who answers on WhatsApp sees the web history.
- Add `/c`: the visitor's own read-only timeline across both channels, with who owns the conversation and "A person will reply" when a human does.

Out of scope: the reply-window countdown on `/c` (add-guards-and-retention), matching people by name or phone number.

Phase 7.
Depends on add-human-handoff and add-web-chat.

## Capabilities

### New Capabilities

- `cross-channel-linking`: link codes and how a web conversation continues on WhatsApp.
- `conversation-timeline`: the visitor-facing timeline at `/c`.

### Modified Capabilities

None.
The web branch of `requestHuman` (from add-human-handoff) changes its link, and that requirement already says "a link that opens a WhatsApp chat", which still holds.

## Impact

- New: `link_codes` table, `src/lib/linking.ts`, `continueOnWhatsApp` tool, `src/app/c/page.tsx`.
- The `message.received` handler checks for a code before running the turn.
