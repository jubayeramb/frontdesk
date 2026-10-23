# Design

## Context

The agent core and the adapter interface exist (add-agent-core, add-whatsapp-channel).
shadcn/ui is set up with the `base-nova` style; its dark variant is class-based today.

## Goals / Non-Goals

**Goals:**
- The web adapter is a thin renderer; the widget is a client component that only knows `AgentReply`.
- Request-response chat with no streaming, so both channels share one code path.

**Non-Goals:**
- Human replies on the web.
  A web conversation is never answered by a person (see add-human-handoff).
- A theme toggle.
  The system setting is enough.

## Decisions

### API shape

`POST /api/chat` with `{ text?: string, choiceId?: string, nonce: string }` returns `{ replies: AgentReply[], conversationId }`.
`GET /api/chat` returns the transcript for the cookie's conversation.
The route resolves the conversation from the cookie, creating a contact, a `web` identity (random id) and a conversation when there is none.
`nonce` is stored as the inbound message's `client_nonce` under a unique index per conversation; a duplicate returns the replies stored after that message.

Alternative: a server action.
Fine for a form, but a plain route is easier to call from Playwright and keeps the same shape as the webhook path.

### Cookie

`fd_conv` holds `conversationId.signature` (HMAC-SHA256 with `CHAT_COOKIE_SECRET`), `httpOnly`, `secure`, `sameSite=lax`, 7 days to match retention.
An invalid signature is treated as no cookie.

### Widget

Client component under `src/components/chat/`, built from shadcn primitives (`Button`, `Sheet` on phones, a popover panel on desktop).
Messages render from a local list seeded by `GET /api/chat`; a send appends optimistically, then appends replies.
Text replies render a small markdown subset (bold, lists, links) through a tiny renderer, not `dangerouslySetInnerHTML`.
Replies are announced with an `aria-live="polite"` region.

### Dark mode

Change `@custom-variant dark` in `globals.css` to `(@media (prefers-color-scheme: dark))`, so the shadcn tokens follow the system.

### Landing page

Server component, static content only, no prices.
Copy follows the voice guide: plain, specific, short.

## Risks / Trade-offs

- [No streaming feels slow on a 4 second turn] → A typing indicator appears at once; the turn budget from add-agent-core keeps most turns short.
- [Public endpoint invites abuse before limits exist] → add-guards-and-retention adds per-contact and global caps; the URL is not shared before then.
- [Cookie lost means conversation lost] → Acceptable for a demo; the WhatsApp link in add-cross-channel-linking is the durable path.
