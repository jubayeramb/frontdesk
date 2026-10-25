# Design

## Context

Every earlier change records surprises in its design (the spike's findings, "record anything odd here" in the real-phone tasks).
Those notes are the only source for "What tripped me up on Kapso".

## Goals / Non-Goals

**Goals:**
- Production mirrors development: same migrations, same seed, same env schema.
- Nothing is shared until the real-phone checklist passes on production.

**Non-Goals:**
- Preview deployments with their own databases.
  One production branch is enough.
- A custom analytics setup.

## Decisions

### Hosting

Vercel for the app, Neon's default branch for production and a `dev` branch for local work.
The `dev` branch has a 30-day TTL and can be recreated; the default branch has none, so production data never expires with it.
Migrations run from a GitHub Actions job on `main` (or by hand before the first deploy), not in the Vercel build, so a failed migration never ships a half-deployed app.
Alternative: run `drizzle-kit migrate` in the build command.
Simpler, but couples deploys to schema changes with no rollback point.

### Diagram

Hand-written SVG checked into the repo, used by both the README and `/how-it-works`, with colors that work in both themes.
Alternative: Mermaid.
Renders on GitHub, but not on the site without a client library.

### Write-up content

Plain voice, short sentences, specific numbers (tokens per turn, Groq limits, webhook retry timings) taken from the notes.
The clean-room rule applies: nothing from the author's employer.

### Video and GIF

Screen recording of the demo script: web quote, continue on WhatsApp (phone mirrored), book, ask for a person, staff reply from `/staff`, hand back.
GIF is a 10 to 15 second cut of the web quote for the README.

## Risks / Trade-offs

- [The display name is not approved] → Messaging stays `LIMITED` until Meta approves it; check the number's health well before launch.
- [A Bangladesh tour agency on a US +1 number reads oddly] → The README and `/how-it-works` say in one line that the number came from Kapso's instant setup.
- [Kapso webhook still points at a dev tunnel] → The checklist starts by checking the webhook URL in Kapso.
- [Inbox embed origin mismatch on the new domain] → Create the production embed with the final origin only after DNS resolves.
- [Real numbers end up in the GIF or video] → Use the test phone and blur its number in the recording.

## Migration Plan

1. Point production at Neon's default branch, run migrations and seed.
2. Create the Vercel project, set every env var from `src/env-schema.ts`, deploy.
3. Add the DNS record and wait for TLS.
4. Create the production Kapso webhook (payload v2) and inbox embed, set their secrets, redeploy.
5. Run the checklist.

Rollback: redeploy the previous Vercel build; point the Kapso webhook back if needed.
