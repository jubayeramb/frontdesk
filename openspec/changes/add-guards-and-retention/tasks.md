# Tasks

## 1. Inbound filtering

- [ ] 1.1 Classify inbound messages (text, interactive, silent, unsupported) and cut long text, and verify unit tests on the reaction, media, sticker, location and long-text fixtures
- [ ] 1.2 Wire classification into the drain handler before the turn, and verify integration tests: a reaction sends nothing, an image gets the fixed reply with no model call

## 2. Usage limits

- [ ] 2.1 Add `turns` and `contacts.limit_notified_at`, record a row per model call with token counts, and verify an integration test that a turn writes one row
- [ ] 2.2 Implement `checkGuards` with per-contact and global limits and the one-reply rule, add `GLOBAL_DAILY_TURN_CAP` to env, and verify integration tests: 25 quick messages call the model 20 times and send one limit reply; the global cap blocks a new contact
- [ ] 2.3 Use `checkGuards` in `/api/chat` too, and verify a Playwright test that the limit reply shows in the widget

## 3. Reply window

- [ ] 3.1 Implement the WhatsApp `replyPolicy` and store blocked sends, and verify unit tests at 23h59m, 24h00m and 24h01m and an integration test that a late reply is stored as blocked
- [ ] 3.2 Add the countdown to `/c` and `/staff`, and verify Playwright tests for an open and a closed window

## 4. Retention

- [ ] 4.1 Add cascade foreign keys, `CRON_SECRET`, the retention route and the `vercel.json` cron, and verify integration tests: old data is deleted, recent activity keeps a conversation, a missing secret is 401
- [ ] 4.2 Update the privacy note to mention Kapso's copy of WhatsApp messages, and verify it renders on `/`

## 5. Real phone

- [ ] 5.1 From a real phone send 25 messages quickly, a photo and a reaction, and verify one limit reply, one "text only" reply, and nothing for the reaction
- [ ] 5.2 Document the limits, the cap and the cron in `AGENTS.md`, and verify the values match the code

## Workflow follow-up

- Run `/opsx:verify`, then `/opsx:archive`.
