# Design

## Context

`GET /api/chat` returns the conversation's last 100 messages, from both channels, mapped to visitor or agent lines.
`POST /api/chat` runs a web turn; `runTurn` returns no replies while a person owns the conversation, so the panel shows nothing.
Staff reply from Kapso's inbox, which only sees WhatsApp, and `/staff` lists handed-over conversations with a preview of the latest message from either channel.
`/c` already renders both channels with `loadTimeline` and refreshes every 5 seconds.

## Goals / Non-Goals

**Goals:**
- The panel tells the same story as `/c`: who said what, on which channel, and who is answering now.
- A web message never disappears into silence.

**Non-Goals:**
- Copying messages between channels. Each reply goes where the customer wrote.
- Letting staff reply on web. People reply from Kapso's inbox only.

## Decisions

### Replies stay on their channel

Copying web replies to WhatsApp would ping the customer's phone for messages they are reading on the site, would fail or need a paid template outside the 24-hour window, and would fill the staff inbox with copies that each go through the "unknown id means a person" rule.
The shared conversation already gives the agent both sides, and the panel and `/c` show both.

### One transcript shape for the panel

`ChatMessage` gets `channel` and a `from` of `visitor`, `agent`, `person` or `note`.
The mapping follows `loadTimeline`: suppressed replies and continuation parts are skipped, system messages become notes only for linking and ownership changes.
The transcript response adds `owner` and `whatsapp` (masked, `•••• 1017`), read the same way `/c` reads them.

Alternative: point the panel at `loadTimeline` itself.
Its entries flatten choices to labels, while the panel needs the full reply to render chips, so the mapping stays separate and shares only the masking and note text.

### Polling

While the panel is open and the tab is visible, it fetches `GET /api/chat` every 5 seconds.
A poll replaces the lines from the server and keeps local lines that are still sending or failed; it is skipped while a send is in flight, so an optimistic line is never dropped and doubled.
New lines from another channel are announced to screen readers like replies.

Alternative: server-sent events.
A long-lived connection per open panel for a demo that already polls on `/c` and `/staff`; polling matches the rest of the app.

### A message while a person owns the conversation

The handler checks the owner before running a turn.
If a person owns it, the visitor's message is stored as usual (so staff see it in the `/staff` preview) and the response carries a fixed `link` reply: "A person from our team is answering on WhatsApp. Reply there to reach them." with "Open WhatsApp" to `wa.me/<number>`, no code.
The notice is not stored; the status strip carries the same message after a reload.
A resubmitted nonce returns the same notice at once instead of waiting for replies that never come.

### Takeover note before the reply

The phone check showed "A person joined" below the staff reply that caused it, because the handler stored the reply and then called `transition()`.
The handler now calls `transition()` first.
This also closes a gap: if the transition failed after the reply was stored, the retried event found the reply's id, returned early, and the conversation never moved to a person.
Now a retry repeats a no-op transition and stores the reply.

## Risks / Trade-offs

- [5-second polls while a panel stays open] → Only while visible; a transcript read is one indexed query.
- [Staff still cannot see a web message in Kapso's inbox] → It shows in the `/staff` "With a person" preview, and the visitor is pointed to WhatsApp.
