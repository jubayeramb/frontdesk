# Tasks

## 1. Accounts and keys

- [x] 1.1 Install the Kapso CLI, run `kapso login` (the user runs this) and verify `kapso status` shows the project
- [x] 1.2 Create an instant-setup number with `kapso setup` and verify `kapso whatsapp numbers list --output json` lists it with a `phone_number_id`
- [x] 1.3 Send "hello" from the test phone to the number and verify it appears in `kapso whatsapp messages list`
- [x] 1.4 Create a Groq API key, add `GROQ_API_KEY`, `KAPSO_API_KEY` and `KAPSO_PHONE_NUMBER_ID` to `.env.local`, and verify `git status` does not list `.env.local`

## 2. Webhook capture

- [x] 2.1 Write `scripts/spike/capture.ts` (writes headers and raw body per request to `tmp/captures/`) and run it behind a `cloudflared` tunnel; verify a curl to the tunnel URL creates a capture file
- [x] 2.2 Create a phone-number webhook (payload v2, buffering off) for `message.received`, `message.sent`, `message.failed` and `conversation.ended`, store the secret in `.env.local`, and verify Kapso's test delivery lands in `tmp/captures/`
  Verified with real deliveries first, then with `POST /platform/v1/whatsapp/webhooks/:id/test` once `KAPSO_API_KEY` was set.
- [x] 2.3 From the phone, send text, a photo and a reaction, and tap a button and a list row (sent with `send-interactive.mjs`); verify one capture per event
- [x] 2.4 Send a message through the API and verify a `message.sent` capture with our message id
- [x] 2.5 Reply from Kapso's inbox UI and verify a `message.sent` capture; diff it against 2.4 and record every field that differs in the findings table
- [x] 2.6 End the conversation from the inbox and verify a `conversation.ended` capture
- [x] 2.7 Turn on buffering (5 second window), send three quick messages, and verify one batched capture; record the envelope and headers
- [x] 2.8 Return 500 from the capture server once and verify the retry carries the same `X-Idempotency-Key`; record the answer

## 3. Signature and fixtures

- [x] 3.1 Verify each capture's `X-Webhook-Signature` equals HMAC-SHA256 hex of its raw body with the webhook secret, using a throwaway script; record the result
- [x] 3.2 Redact captures (phone numbers, names), re-sign them with a fixed test secret, save them to `test/fixtures/kapso/<event>.json` as `{ headers, body }`, and verify `grep` finds neither the real phone number nor the real secret in `test/`

## 4. Groq

- [x] 4.1 Install `ai` and `@ai-sdk/groq`, write `scripts/spike/groq-tools.ts` with two tools and a two-step task, and verify the primary model returns a final answer that used both tool results
- [x] 4.2 Run the same script on the fallback model and verify the same; record the rate-limit headers and the limits page values in the findings table

## 5. Write up

- [x] 5.1 Fill in the Findings and Impact sections of this design and verify every row has an answer and evidence
- [x] 5.2 Update the later proposals and designs the findings affect, and verify `pnpm spec:validate` passes
- [x] 5.3 Delete `scripts/spike/` and `tmp/captures/`, keeping `ai` and `@ai-sdk/groq` installed, and verify `pnpm typecheck && pnpm lint && pnpm test` pass

## Workflow follow-up

- Run `/opsx:verify`, then `/opsx:archive`.
