# Design

## Context

The WhatsApp pipeline stores each webhook event, answers 200, then claims and processes it in `after()` (add-whatsapp-channel).
On the real phone, the claim, the duplicate check and the conversation lookups took ~4.5 seconds before the turn started, because each round trip from Dhaka to Neon in us-east is slow; the model took ~2 seconds after that.
The Kapso SDK exposes `messages.markRead({ phoneNumberId, messageId, typingIndicator: { type: "text" } })`.

## Goals / Non-Goals

**Goals:**
- The customer sees "typing…" within a second or two of sending.
- Every option label is readable in full on WhatsApp.
- Reply text reads naturally above the options on both channels.

**Non-Goals:**
- Keeping the indicator up past WhatsApp's 25 seconds; turns are shorter than that.
- Cutting the database time before a turn; deploy-and-document looks at it.

## Decisions

### An optional adapter method

`ChannelAdapter.showTyping?(inboundExternalId): Promise<void>` keeps Kapso calls inside the adapter, as the architecture rules require.
The web adapter leaves it out, because the widget shows its own indicator.
It resolves on failure and logs the error code, so callers never handle it.

### Started when the event is first stored

The first real-phone run started the indicator with the turn, ~6 seconds after the customer sent, so it showed for a second at most.
`storeEvents` now returns the events stored for the first time, and `receiveKapsoWebhook` calls an `acknowledge` callback for each of them at the start of the after-response work, alongside the drain.
`createKapsoAcknowledger` shows the indicator only for `whatsapp.message.received` events that `mapInbound` would answer, so images and reactions get no read receipt.
A duplicate delivery is not fresh, so it never shows the indicator twice, and a retried event that skips its turn shows none.

Alternative: start it inside the handler before the duplicate check.
Rejected because the claim alone takes seconds from Dhaka.

### Buttons only for labels that fit

A button title holds 20 characters and has no second line, so a cut label is lost.
Choices use buttons only when every label fits; otherwise a list, whose row keeps the full label as its description.
The tours ("Sundarbans 3-day boat tour") now go as a list; the departures ("Thu 29 Oct") were already a list or fit a button.

### Lists name what they open

A list message opens from a button whose text is also the list's header, and "Choose" told the customer nothing.
The tool that builds the options knows what they are, so a `choices` reply carries an optional `label` ("View tours", "View dates"), and the WhatsApp renderer uses it for the list button, cut to 20 characters.
Choices stored before this have no label and keep "Choose".
The web widget ignores it, since its chips show without a control to open them.

### Options named by no widget, and stripped when repeated

The tool note and the prompt rule said "buttons", and the model echoed it ("tap a button below").
Both now say the options are shown under the reply and give a one-line example, without naming a widget.
Prompting alone did not stop the model listing departures in a live run, so `dropListedOptions` removes list lines that only repeat an option label and ends a dangling lead-in colon with a full stop, the way the price guard enforces prices in code.

## Risks / Trade-offs

- [Read receipts become visible: the customer sees blue ticks] → That matches what a person in the inbox would do, and it tells the customer the message arrived.
- [The receipt could land after a very fast reply and show "typing…" afterwards] → The receipt takes ~0.6 seconds and the turn several, so this needs Kapso to be slower than the whole turn.
- [Options listed inline in a sentence are not removed] → Only list lines are matched, so ordinary sentences are never cut; the prompt covers the rest.
