# Design

## Context

The WhatsApp handler stores the inbound message, maps it, runs the turn and delivers the replies (add-whatsapp-channel).
The Kapso SDK exposes `messages.markRead({ phoneNumberId, messageId, typingIndicator: { type: "text" } })`, which posts a read status with `typing_indicator` to the Meta proxy.

## Goals / Non-Goals

**Goals:**
- The customer sees "typing…" within a second of the webhook arriving.

**Non-Goals:**
- Keeping the indicator up past WhatsApp's 25 seconds; turns are shorter than that.
- A typing indicator on the web, which the widget already shows.

## Decisions

### An optional adapter method

`ChannelAdapter.showTyping?(inboundExternalId): Promise<void>` keeps Kapso calls inside the adapter, as the architecture rules require.
The web adapter leaves it out.
It resolves on failure and logs the error code, so callers never handle it.

### Started with the turn, awaited after it

The handler starts `showTyping` and `runTurn` together and awaits the indicator only after the turn, so its round trip to Kapso never adds to the reply time.
It starts after the message is mapped, so skipped messages never get read receipts.

## Risks / Trade-offs

- [Read receipts become visible: the customer sees blue ticks] → That matches what a person in the inbox would do, and it tells the customer the message arrived.
- [A retried event shows the indicator again] → Harmless; a retry that skips the turn skips the indicator too, because the dedupe check comes first.
