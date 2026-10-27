# Tasks

## 1. Deploy

- [x] 1.1 Use Neon's default branch for production (it has no TTL, unlike the `dev` branch), run migrations and seed against it, and verify the pricing tables hold the defaults
- [x] 1.2 Add a GitHub Actions job that runs migrations on `main` with the production URL as a secret, and verify it runs green on a no-op migration
- [x] 1.3 Create the Vercel project with every env var in `src/env-schema.ts`, deploy, and verify `/` loads on the Vercel URL
- [x] 1.4 Add the subdomain the user chose, and verify `/` loads over HTTPS on it
- [x] 1.5 Create the production Kapso webhook and inbox embed for the production origin, set their secrets, redeploy, and verify Kapso's test delivery returns 200 and `/staff` loads the inbox
- [ ] 1.6 Add Vercel Web Analytics to the root layout, say so in the footer's privacy note, and verify page views show up after a production deploy
- [x] 1.7 Move production to Kapso's sandbox number after Meta disabled Triplone (new production webhook and inbox embed, development webhook off, env pushed, redeployed), and verify the site links to the sandbox number, an unsigned webhook gets 401 and Kapso's test delivery gets 200

## 2. Real-phone checklist on production

- [ ] 2.1 Quote, book, ask for a person, reply from `/staff` (agent quiet), hand back, agent answers; verify each step
- [ ] 2.2 Change a price in `/staff/pricing`, and verify the next WhatsApp quote shows it
- [ ] 2.3 Web quote, tap the link, and verify WhatsApp continues with the quote
- [ ] 2.4 Replay a webhook twice, and verify no double reply
- [ ] 2.5 Send 25 messages quickly, and verify the limit reply and 20 model calls in the `turns` table
- [ ] 2.6 Ask an off-topic question, and verify a scoped refusal
- [x] 2.7 Check `/`, `/c`, `/staff` and `/how-it-works` at phone width and in dark mode on production, and fix anything off

## 3. Write-up

- [x] 3.1 Draw the architecture SVG and verify it reads in light and dark
- [x] 3.2 Collect every surprise from the archived designs into "What tripped me up on Kapso", and verify each item traces to a note
- [x] 3.3 Build `/how-it-works` and verify the project-writeup scenarios with Playwright
- [ ] 3.4 Rewrite the README (what it is, GIF, diagram, run locally, what works, what is stubbed, what is next, and why a Bangladesh agency uses a US +1 number) in the voice guide's style, and verify every command in it runs
- [ ] 3.5 Record the GIF and the 30 to 60 second video, and verify no real phone number is visible
- [x] 3.6 Say on the home page, `/how-it-works`, the README and `AGENTS.md` that WhatsApp runs on the sandbox and only answers registered phones, with an email for access, and verify with the home page e2e test

## Workflow follow-up

- Run `/opsx:verify`, then `/opsx:archive`.
- Make the repo public only when the user says so.
