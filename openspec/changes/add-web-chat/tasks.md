# Tasks

## 1. Web adapter and API

- [x] 1.1 Implement the web adapter (`render` passes replies through, `send` is a no-op that marks messages delivered) and verify unit tests that every reply kind survives rendering unchanged
- [x] 1.2 Add `CHAT_COOKIE_SECRET` to env, and the cookie sign and verify helpers; verify unit tests for valid, tampered and missing cookies
- [x] 1.3 Implement `POST` and `GET /api/chat` (conversation from cookie, nonce dedupe, `runTurn`, transcript, and an `after()` webhook `sweep()` as add-whatsapp-channel's design relies on) and verify integration tests: first message creates a conversation, a duplicate nonce runs one turn, a forged cookie gets a fresh conversation, a stuck WhatsApp event is processed after a chat request

## 2. Widget

- [x] 2.1 Build the bubble and panel (desktop popover, phone full-screen sheet), the message list, the input and the typing indicator; verify a Playwright test that sends a message and sees a reply with the model mocked
- [x] 2.2 Render `choices` as chips that send the option and disable the rest, and `link` as a button; verify Playwright tests for a departure pick and a link reply
- [x] 2.3 Add the error state with retry and verify a Playwright test that a failed request shows the retry and a retry succeeds
- [x] 2.4 Restore the transcript on reopen and reload, and verify a Playwright test that a quote survives a reload
- [x] 2.5 Add keyboard handling, focus management and the live region, and verify a Playwright test that drives the chat with the keyboard only and an axe check with no serious violations

## 3. Landing page and theme

- [x] 3.1 Switch the dark variant to `prefers-color-scheme` and verify Playwright screenshots of `/` in light and dark
- [x] 3.2 Write the landing page (tours, how to book, banner, privacy footer) in the voice guide's style, and verify the demo-site scenarios with Playwright
- [x] 3.3 Check `/` with the chat open at 360px and 1280px in both themes, and fix anything misaligned or clipped

## 4. End to end

- [x] 4.1 Add the Playwright journey from the plan (web quote, then booking a departure) with the mocked model, and verify it passes on desktop and phone projects
- [x] 4.2 Run the same journey by hand against Groq in `pnpm dev`, and verify the quote matches the seeded prices

## Workflow follow-up

- Run `/opsx:verify`, then `/opsx:archive`.
