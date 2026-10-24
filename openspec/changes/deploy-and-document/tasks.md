# Tasks

## 1. Deploy

- [ ] 1.1 Create the Neon production branch, run migrations and seed against it, and verify the pricing tables hold the defaults
- [ ] 1.2 Add a GitHub Actions job that runs migrations on `main` with the production URL as a secret, and verify it runs green on a no-op migration
- [ ] 1.3 Create the Vercel project with every env var in `src/env-schema.ts`, deploy, and verify `/` loads on the Vercel URL
- [ ] 1.4 Add the subdomain the user chose, and verify `/` loads over HTTPS on it
- [ ] 1.5 Create the production Kapso webhook and inbox embed for the production origin, set their secrets, redeploy, and verify Kapso's test delivery returns 200 and `/staff` loads the inbox

## 2. Real-phone checklist on production

- [ ] 2.1 Quote, book, ask for a person, reply from `/staff` (agent quiet), hand back, agent answers; verify each step
- [ ] 2.2 Change a price in `/staff/pricing`, and verify the next WhatsApp quote shows it
- [ ] 2.3 Web quote, tap the link, and verify WhatsApp continues with the quote
- [ ] 2.4 Replay a webhook twice, and verify no double reply
- [ ] 2.5 Send 25 messages quickly, and verify the limit reply and 20 model calls in the `turns` table
- [ ] 2.6 Ask an off-topic question, and verify a scoped refusal
- [ ] 2.7 Check `/`, `/c`, `/staff` and `/how-it-works` at phone width and in dark mode on production, and fix anything off

## 3. Write-up

- [ ] 3.1 Draw the architecture SVG and verify it reads in light and dark
- [ ] 3.2 Collect every surprise from the archived designs into "What tripped me up on Kapso", and verify each item traces to a note
- [ ] 3.3 Build `/how-it-works` and verify the project-writeup scenarios with Playwright
- [ ] 3.4 Rewrite the README (what it is, GIF, diagram, run locally, what works, what is stubbed, what is next, and why a Bangladesh agency uses a US +1 number) in the voice guide's style, and verify every command in it runs
- [ ] 3.5 Record the GIF and the 30 to 60 second video, and verify no real phone number is visible

## Workflow follow-up

- Run `/opsx:verify`, then `/opsx:archive`.
- Make the repo public only when the user says so.
