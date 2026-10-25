# Proposal

## Why

The only way to reach the front desk from the site is the floating "Chat with us" button.
A visitor who would rather use WhatsApp has to start a web chat and ask for a link first.
There is also no way to get from the site to `/staff` or back to the chat from `/c` without typing a URL.

## What Changes

- A header on the public pages (`/` and `/c`) with the Triplone Tours name and three links: "Chat", "Conversation" and "Staff".
- "Chat" opens the web chat panel on the home page, from any public page.
- "Conversation" goes to `/c`.
- "Staff" goes to `/staff`, which still asks for the staff password.
- The home page hero gets two buttons: "Chat on the website", which opens the panel, and "Chat on WhatsApp", which opens WhatsApp with the demo number and a short greeting filled in.
- A conversation started from the WhatsApp button is a plain WhatsApp conversation; it carries no link code and nothing from a web chat.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

demo-site

## Impact

- New `src/components/site-header.tsx`, used by `/` and `/c`.
- `src/components/chat/chat-widget.tsx` opens when the URL hash is `#chat`.
- `src/lib/linking.ts` gains `whatsappStartLink(number)`.
- `next.config.ts` allows tunnel and local network origins in development, so a phone can load the dev server's scripts.
- `e2e/home.spec.ts` covers the header, both buttons and the hash.
