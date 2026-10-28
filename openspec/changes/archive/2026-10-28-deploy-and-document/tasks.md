# Tasks

## 1. Deploy

- [x] 1.1 Use Neon's default branch for production (it has no TTL, unlike the `dev` branch), run migrations and seed against it, and verify the pricing tables hold the defaults
- [x] 1.2 Add a GitHub Actions job that runs migrations on `main` with the production URL as a secret, and verify it runs green on a no-op migration
- [x] 1.3 Create the Vercel project with every env var in `src/env-schema.ts`, deploy, and verify `/` loads on the Vercel URL
- [x] 1.4 Add the subdomain the user chose, and verify `/` loads over HTTPS on it
- [x] 1.5 Create the production Kapso webhook and inbox embed for the production origin, set their secrets, redeploy, and verify Kapso's test delivery returns 200 and `/staff` loads the inbox
- [x] 1.6 Add Vercel Web Analytics to the root layout, say so in the footer's privacy note, and verify the script loads on production (it is served from a first-party path). Page views in the Vercel dashboard were not checked.
- [x] 1.7 Move production to Kapso's sandbox number after Meta disabled Triplone (new production webhook and inbox embed, development webhook off, env pushed, redeployed), and verify the site links to the sandbox number, an unsigned webhook gets 401 and Kapso's test delivery gets 200

## 2. Real-phone checklist on production

- [x] 2.1 Quote, book, ask for a person, reply from `/staff` (agent quiet), hand back, agent answers; verified in the 2026-10-28 recording on the sandbox number, with the quote and booking made on the web and continued on WhatsApp
- [x] 2.2 Change a price in `/staff/pricing` and verify the next quote shows it; not run on a phone after Meta disabled Triplone, covered by `price-list.int.test.ts` and the live agent test (`LIVE_LLM=1`)
- [x] 2.3 Web quote, tap the link, and verify WhatsApp continues with the quote; verified in the 2026-10-28 recording (code TR-C88DTP, then the booking reference on WhatsApp)
- [x] 2.4 Replay a webhook twice and verify no double reply; not run on a phone after the ban, covered by `kapso-handler.int.test.ts` ("replies once when Kapso delivers the same message twice") and `receive.int.test.ts`
- [x] 2.5 Send 25 messages quickly and verify the limit reply and 20 model calls; not run on a phone after the ban, covered by `kapso-handler.int.test.ts` ("calls the model 20 times for 25 quick messages") and `e2e/limits.spec.ts`
- [x] 2.6 Ask an off-topic question and verify a scoped refusal; verified live on production's web chat on 2026-10-28 ("I can only help with Triplone Tours' tours, quotes, and bookings.")
- [x] 2.7 Check `/`, `/c`, `/staff` and `/how-it-works` at phone width and in dark mode on production, and fix anything off

## 3. Write-up

- [x] 3.1 Draw the architecture SVG and verify it reads in light and dark
- [x] 3.2 Collect every surprise from the archived designs into "What tripped me up on Kapso", and verify each item traces to a note
- [x] 3.3 Build `/how-it-works` and verify the project-writeup scenarios with Playwright
- [x] 3.4 Rewrite the README (what it is, poster, diagram, run locally, what works, what is stubbed, what is next, and how to try WhatsApp on the sandbox) in the voice guide's style, and verify every command in it runs; the poster replaced the GIF
- [x] 3.5 Record the demo video and verify no real phone number is visible; a 9:32 walkthrough with the number blurred in the inbox header, unlisted on YouTube with chapters, in place of the GIF and the 30 to 60 second cut
- [x] 3.6 Say on the home page, `/how-it-works`, the README and `AGENTS.md` that WhatsApp runs on the sandbox and only answers registered phones, with an email for access, and verify with the home page e2e test
- [x] 3.7 Make a 1280x720 poster from the demo recording (no phone number in view) for the video thumbnail and the top of the README, and verify it renders on GitHub

## Workflow follow-up

- Run `/opsx:verify`, then `/opsx:archive`.
- Make the repo public only when the user says so.
