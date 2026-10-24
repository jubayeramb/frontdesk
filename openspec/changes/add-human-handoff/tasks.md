# Tasks

## 1. Ownership

- [ ] 1.1 Implement `transition` with system messages, and verify unit tests for every transition and every no-op in the state machine
- [ ] 1.2 Gate the drain handler and `runTurn` on the owner (skip when human, suppress a reply when ownership changed mid-turn), and verify integration tests for both cases

## 2. Handoff tool and detection

- [ ] 2.1 Add `requestHuman` (handoff on WhatsApp, WhatsApp link on web) and `NEXT_PUBLIC_WHATSAPP_NUMBER` to env; verify mock-model tests for both channels
- [ ] 2.1a Route booking change and cancellation requests to `requestHuman` (prompt rule and tool description), and verify mock-model tests that a cancel request hands off on WhatsApp and gets the link on the web, and a live replay that "move our booking to the next date" offers no departures
- [ ] 2.2 Add `not_before` to `webhook_events` and the claim query, and verify an integration test that a deferred event is not claimed early
- [ ] 2.3 Handle `message.sent` (id match, deferral, human reply), and verify integration tests on fixtures: our echo before the id is stored stays AI, an unknown id after three checks becomes human
- [ ] 2.4 Handle `conversation.ended` and verify an integration test that a human-owned conversation returns to AI

## 3. Staff page

- [ ] 3.1 Write `scripts/create-inbox-embed.ts`, create the development embed, add `KAPSO_INBOX_EMBED_URL` to env, and verify the embed loads at `localhost` and is refused from another origin
- [ ] 3.2 Build `/staff` (embedded inbox and conversation list with badges and hand back), and verify a Playwright test with the embed stubbed: the list shows owners and hand back flips the badge
- [ ] 3.3 Verify with a Playwright test that `/` and `/staff/sign-in` responses never contain the embed URL
- [ ] 3.4 Check `/staff` at phone width and in dark mode, and fix anything misaligned

## 4. Real phone

- [ ] 4.1 From a real phone: quote, ask for a person (owner flips, agent quiet), reply from `/staff` (stored as human, agent quiet), hand back, and get an agent answer; verify each step and record anything odd here
- [ ] 4.1a From a real phone with a booking, ask to cancel it, and verify the conversation is handed to a person and no booking changes
- [ ] 4.2 Reply from the inbox to an AI-owned conversation without a handoff request, and verify the agent goes quiet
- [ ] 4.3 Document the inbox embed setup and revocation in `AGENTS.md`, and verify the steps run as written

## Workflow follow-up

- Run `/opsx:verify`, then `/opsx:archive`.
