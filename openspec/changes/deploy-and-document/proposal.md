# Proposal

## Why

The work only counts once someone can open a link, message a number, and read how it was built.
A short, honest write-up, including what was hard on Kapso, is worth more to a reader than another feature.

## What Changes

- Deploy to Vercel with a Neon production branch, migrations and seed, all env vars, and a subdomain.
- Create the production Kapso webhook and inbox embed, pointed at the production URL.
- Add `/how-it-works`: the architecture diagram, the main decisions, and "What tripped me up on Kapso", drawn from notes kept in every earlier change.
- Rewrite the README: what it is, a GIF, the diagram, how to run it, what works, what is stubbed, what is next.
- Record a 30 to 60 second video of the demo script.
- Run the full real-phone checklist against production before anything is shared.

Out of scope: making the repo public, which happens only when the user says so.

Needs from the user before apply: the subdomain (suggested `frontdesk.jubayeramb.com`), any byline or contact links for the README and write-up, and the go-ahead to make the repo public.

Phase 9.
Depends on add-human-handoff at minimum; add-cross-channel-linking and add-guards-and-retention should be archived first so the write-up describes the finished system.

## Capabilities

### New Capabilities

- `project-writeup`: the public `/how-it-works` page that explains how Front Desk works and what was learned building it.

### Modified Capabilities

None.

## Impact

- New: `src/app/how-it-works/page.tsx`, `README.md` rewrite, `public/demo.gif`, diagram asset.
- External: Vercel project, Neon production branch, DNS record, production Kapso webhook and inbox embed.
