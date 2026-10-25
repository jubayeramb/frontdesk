# Tasks

## 1. Codes

- [x] 1.1 Add `link_codes` and `conversations.closed_at`, and verify the migration applies
- [x] 1.2 Implement code generation and parsing, and verify unit tests for the alphabet, case, spacing, and text with no code or two codes
- [x] 1.3 Implement the link transaction and verify integration tests: valid code links and carries the quote, expired code does nothing, a reused code fails, two concurrent uses link once, a returning number's old conversation is closed

## 2. Tools and handler

- [x] 2.1 Add `continueOnWhatsApp` (web only) and switch the web `requestHuman` to the coded link; verify mock-model tests that the link contains a fresh valid code and is not offered on WhatsApp
- [x] 2.2 Run linking before the turn in the `message.received` handler, replacing the code text with the system note; verify an integration test from a fixture with a code to a turn that sees the web quote

## 3. Timeline

- [x] 3.1 Build `/c` with channel marks, owner badge, masked numbers and the empty state, and verify Playwright tests for a linked conversation, a human-owned one, and no cookie
- [x] 3.2 Refresh the timeline every 5 seconds, paused when the tab is hidden, and verify a Playwright test that a new message appears within 10 seconds
- [x] 3.3 Check `/c` at phone width and in dark mode, and fix anything misaligned

## 4. End to end

- [x] 4.1 Extend the Playwright journey: web quote, "Continue on WhatsApp", and assert the link's prefilled text holds a valid code
- [x] 4.2 From a real phone: get a web quote, tap the link, send the prefilled message, and verify WhatsApp continues with the quote and `/c` shows both channels

## Workflow follow-up

- Run `/opsx:verify`, then `/opsx:archive`.
