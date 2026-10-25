# Proposal

## Why

After a visitor continues on WhatsApp, web and WhatsApp share one conversation, but the web chat panel does not show it that way.
The panel loads the transcript once, when it opens, so WhatsApp messages and staff replies that arrive later never appear.
It does not say which channel a message came from, and it shows a staff reply as if the agent wrote it.
When a person owns the conversation, a message sent from the panel gets no reply at all: the agent stays quiet, and staff answer only on WhatsApp.

## What Changes

- Every reply stays on the channel the customer used; nothing is copied from web to WhatsApp or back. The spec says so.
- The panel shows both channels: each message from WhatsApp is marked "WhatsApp", staff replies are shown as "Triplone Tours team", and the "Continued on WhatsApp", "A person joined" and "The front desk agent is back" notes appear.
- The panel refreshes its transcript every 5 seconds while it is open and the tab is visible.
- Once the conversation continues on WhatsApp, the panel shows "This chat continues on WhatsApp" with the masked number and an "Open WhatsApp" link.
- While a person owns the conversation, the panel says "A person from our team is answering on WhatsApp", and a message sent from the panel is stored and answered with a fixed notice pointing to WhatsApp instead of silence.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

web-chat

## Impact

- `src/lib/web-chat/types.ts`: `ChatMessage` gains `channel`, a `person` sender and notes; `ChatTranscriptResponse` gains `owner` and `whatsapp`.
- `src/lib/web-chat/handler.ts`: the transcript mapping and the human-owner notice.
- `src/components/chat/chat-widget.tsx`: channel labels, notes, the status strip and polling.
- `src/lib/webhooks/kapso-handler.ts` records an inbox takeover before storing the reply.
- Tests in `handler.int.test.ts` and `e2e/chat.spec.ts`.
