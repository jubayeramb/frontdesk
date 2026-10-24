# Proposal

## Why

Most visitors will meet Front Desk on the website first, and the web is where the demo starts: ask for a price, get a quote, pick a departure.
The web chat proves the agent core is channel-agnostic, because it renders the same replies WhatsApp gets, natively.

## What Changes

- Replace the placeholder home page with the Triplone Tours landing page: the three tours, how booking works, the demo banner and a privacy note.
- Add the chat widget: a floating bubble that opens a panel, renders `text`, `choices` (as chips), `handoff` and `link` replies, and works with a keyboard and a screen reader.
- Add the web adapter (renders every reply natively, sends by returning JSON) and `POST /api/chat`.
- Keep the visitor's conversation in a signed, `httpOnly` cookie, and restore the transcript when the widget reopens.
- Make a resubmitted message (double click, network retry) produce one turn, not two.
- Switch dark mode to follow the system setting.

Out of scope: "Continue on WhatsApp" (add-cross-channel-linking), what happens when a web visitor asks for a person (add-human-handoff), rate limits (add-guards-and-retention), streaming.

Phase 5.
Depends on add-agent-core.
Independent of add-whatsapp-channel apart from the shared adapter interface it introduces.

## Capabilities

### New Capabilities

- `web-chat`: the chat widget, the chat API, and how a web visitor's conversation is kept.
- `demo-site`: the public Triplone Tours pages, the demo banner, and the privacy note.

### Modified Capabilities

None.

## Impact

- New: `src/app/page.tsx` rewrite, `src/components/chat/`, `src/lib/channels/web.ts`, `src/app/api/chat/route.ts`.
- `src/app/globals.css` dark variant changes from a class to `prefers-color-scheme`.
- New env var: `CHAT_COOKIE_SECRET`.
