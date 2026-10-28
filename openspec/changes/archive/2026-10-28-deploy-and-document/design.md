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
  Vercel Web Analytics counts page views with no cookies, which is enough to see whether shared links get opened.

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

### Video and poster

Screen recording of the demo: web quote and booking, continue on WhatsApp with a code, a staff reply from `/staff`, hand back, lists and buttons, asking for a person, then `/how-it-works`.
It ran 9:32 and is shared uncut, unlisted on YouTube with chapters, with the phone number in Kapso's inbox header blurred.
A 1280x720 poster made from the recording replaced the GIF: it is the video thumbnail and the top of the README.

### The real-phone checklist after the ban

Meta disabled Triplone for good on 2026-10-27, partway through the checklist.
The flows the recording shows count as verified on the sandbox, the off-topic refusal was checked live on the web chat, and the rest (price change, webhook replay, the limit) rely on their integration and e2e tests rather than a live run.

## Risks / Trade-offs

- [The display name is not approved] → Messaging stays `LIMITED` until Meta approves it; check the number's health well before launch.
- [Meta disabled the Triplone number on 2026-10-27] → Production moved to Kapso's sandbox number, which only answers phones registered in the Kapso dashboard.
  Options: keep the WhatsApp buttons with a note and an email for access (chosen), or hide them and show WhatsApp only in the video.
  The note keeps WhatsApp visible to a reader who wants to try it, at the cost of a step before it works; hiding it avoids a dead end but hides half the project.
  The Triplone production values are kept in a local backup, so switching back is one push if Meta reverses the ban.
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
