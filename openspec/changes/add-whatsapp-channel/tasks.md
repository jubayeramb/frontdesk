# Tasks

## 1. Adapter and rendering

- [ ] 1.1 Add `src/lib/channels/types.ts` with the adapter interface and `OutboundMessage`, and verify `pnpm typecheck` passes
- [ ] 1.2 Implement the WhatsApp `render` (buttons, list, numbered text, label limits, splitting, markdown stripping) and verify unit tests with 3, 10 and 12 options, a long label, a long text, and bold and link markdown
- [ ] 1.3 Implement inbound mapping (button reply, list reply, number against the last numbered choices, free text) and verify unit tests against the spike fixtures
- [ ] 1.4 Add `@kapso/whatsapp-cloud-api` (exact version), the Kapso env vars, and `send` with the outbox (insert with nonce, set external id, mark failed on error); verify integration tests with the SDK mocked at the HTTP boundary

## 2. Webhook pipeline

- [ ] 2.1 Add the `webhook_events` table and verify the migration applies
- [ ] 2.2 Implement signature verification and verify unit tests on fixtures: valid, wrong secret, missing header, non-hex, wrong length
- [ ] 2.3 Implement the envelope normalizer and dedupe key, and verify unit tests on the single and batched fixtures
- [ ] 2.4 Implement the route (verify, normalize, store, 200, `after()` drain and sweep), and verify integration tests: forged request is 401 with no rows, a replayed fixture stores one row, a batch stores three
- [ ] 2.5 Implement claim, drain and sweep, and verify integration tests: two concurrent drains process each event once and in order, a stale `processing` row is retried, three failures end `failed`
- [ ] 2.6 Wire `message.received` to `runTurn` plus WhatsApp `render` and `send`, and `message.failed` to marking the message; verify an integration test from fixture to stored outbound messages with the model mocked

## 3. Real phone

- [ ] 3.1 Run the app behind a tunnel with the Kapso webhook pointed at it, and from a real phone get a quote, see slots as a list, tap one and book it; verify each step and record anything odd in this design
- [ ] 3.2 Replay one captured webhook twice with curl and verify the phone receives no second reply
- [ ] 3.3 Document the tunnel workflow and Kapso env vars in `AGENTS.md`, and verify the steps run as written

## Workflow follow-up

- Run `/opsx:verify`, then `/opsx:archive`.
