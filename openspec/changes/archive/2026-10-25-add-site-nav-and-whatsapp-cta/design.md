# Design

## Context

The chat panel is a client component on `/` only, opened by its own trigger.
`/c` is a server page with no panel.
The demo number is `NEXT_PUBLIC_WHATSAPP_NUMBER`, already used for the "Continue on WhatsApp" link.

## Decisions

"Chat" is a plain link to `/#chat`, and the panel opens when the hash is `#chat`, on load and on `hashchange`.
The same link works from `/c`, needs no shared client state, and still navigates before hydration.
When the panel closes, the hash is removed with `history.replaceState`, so the next click opens it again and a reload does not reopen it.

Alternative: a React context or a custom event between the header and the panel.
It only works on pages that render the panel, so `/c` would need a different link anyway.

The WhatsApp button links to `https://wa.me/<number>?text=Hi! I'd like to ask about your tours.` and opens in a new tab.
The greeting gives the agent something to answer and gives the visitor a message they only have to send.
It never contains `TR-`, so `findCode` ignores it.

The header lives in its own component, rendered under the demo banner so the banner stays the first thing on the page.
The staff console keeps its own layout and does not get this header.

The phone check found that no button worked on a phone: Next blocks its dev scripts and HMR socket for any origin other than `localhost`, so the page never hydrated.
`allowedDevOrigins` lists `*.trycloudflare.com` and the private `192.168.*.*` and `10.*.*.*` ranges.
It only applies to `next dev`; production has no such check.

## Risks / Trade-offs

- [The "Staff" link is visible to every visitor] → `/staff` is password-protected already, and the demo is meant to show both sides.
