# Proposal

## Why

A real-phone run on WhatsApp showed three things that read badly.
A turn takes 6 to 9 seconds and the customer sees nothing until the reply lands, while the web widget shows a typing indicator at once.
Tour buttons were cut to "Sundarbans 3-day…" and "Sylhet tea gardens…", with no way to see the full name.
The model wrote "(shown as buttons below)" and "tap a button to see details" above the options, and sometimes listed the departures it was also sending as options.

## What Changes

- Show WhatsApp's typing indicator as soon as a new customer message is stored, by marking it read with `typing_indicator`.
  It runs alongside the processing, never delays the reply, and a failure to show it never stops the reply.
  Duplicates and messages the agent skips (images, reactions) get neither.
- Send choices as reply buttons only when every label fits a button title; otherwise send a list, whose rows keep the full label.
- Label each list's button with what it opens ("View tours", "View dates") instead of "Choose".
- Lead into options with one short sentence that names no widget, and drop list lines in the reply that only repeat the options.

Out of scope: making turns faster (deploy-and-document looks at Groq and Neon latency), and skipping the indicator while a person owns the conversation (add-human-handoff adds ownership checks).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `whatsapp-channel`: adds the typing indicator, and long labels move choices from buttons to a list.
- `front-desk-agent`: options are introduced, not repeated or described.

## Impact

- `ChannelAdapter` gets an optional `showTyping(inboundExternalId)`; the WhatsApp adapter implements it with the SDK's `markRead` and `typingIndicator`.
- `receiveKapsoWebhook` takes an `acknowledge` callback for newly stored events, and `storeEvents` returns them.
- `AgentReply` choices get an optional `label`, set by the tools that build them.
- `src/lib/channels/whatsapp/render.ts`, `src/lib/agent/prompt.ts`, `src/lib/agent/tools.ts`, and a new `src/lib/agent/listed-options.ts`.
- `test/support/fake-kapso.ts` tells read receipts apart from sends.
