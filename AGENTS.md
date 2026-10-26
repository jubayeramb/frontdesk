# Front Desk

Front Desk is one AI agent that answers customers on web chat and WhatsApp for a made-up tour agency, Triplone Tours (demo) in Dhaka, Bangladesh.
It covers the hard parts of an omnichannel agent: one agent across two channels, replies that degrade per channel, AI and human ownership with handoff, and WhatsApp's 24-hour reply window.
WhatsApp runs through Kapso, and people reply from Kapso's inbox embedded at `/staff`.
Nothing here takes real bookings.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint, fails on any warning |
| `pnpm typecheck` | Generate route types, then `tsc --noEmit` |
| `pnpm test` | Unit tests (Vitest), no database |
| `pnpm test:int` | Integration tests (`*.int.test.ts`) against the docker test database |
| `pnpm test:e2e` | End-to-end tests (Playwright). Builds and starts the app on port 3100 against its own `frontdesk_e2e` database |
| `pnpm db:test:up` | Start the docker test database (Postgres 17 plus Neon's wsproxy) |
| `pnpm db:test:down` | Stop it and delete its data |
| `pnpm db:generate` | Generate a migration from `src/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations to `DATABASE_URL` through the app's own driver |
| `pnpm db:seed` | Load the default tours and price list (safe to rerun, keeps staff edits) |
| `pnpm agent:chat` | Talk to the agent in the terminal on a fresh conversation (`--channel whatsapp` for the WhatsApp hint). Numbers pick an option, `/new` starts over, `/quit` leaves. Calls Groq for real |
| `LIVE_LLM=1 pnpm test:int` | Also run the live agent tests against Groq on both models. They pause 15 seconds between tests to stay under the per-minute token limit |
| `pnpm inbox:embed` | Create the Kapso inbox embed for `/staff` (`--origin <origin>`, repeatable, and `--write-env .env.local`), or revoke one with `--revoke <embed-id>` |
| `pnpm spec:validate` | `openspec validate --all --strict` |

Copy `.env.example` to `.env.local` before running anything that touches the database.
`pnpm test:int` and `pnpm test:e2e` need `pnpm db:test:up` first; they never touch `DATABASE_URL`.
`pnpm agent:chat` uses `DATABASE_URL`, so run `pnpm db:migrate && pnpm db:seed` against it first.

### Environment

| Variable | Used for |
|---|---|
| `DATABASE_URL` | Neon Postgres. Use the pooled connection string |
| `DATABASE_WS_PROXY` | Only for a local Postgres behind wsproxy, e.g. `localhost:5433/v1` |
| `KAPSO_API_KEY` | Sends WhatsApp messages through Kapso's Meta proxy |
| `KAPSO_PHONE_NUMBER_ID` | Kapso's numeric `phone_number_id` for the demo number. Events for any other number are dropped |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | The demo number, digits only. Web visitors who ask for a person get a `wa.me` link to it |
| `KAPSO_WEBHOOK_SECRET` | Verifies `X-Webhook-Signature` on Kapso webhooks. Kapso shows it once, when the webhook is created |
| `GROQ_API_KEY` | The agent's models on Groq. Tests that don't set `LIVE_LLM=1` never call it |
| `GROQ_BASE_URL` | Unset outside tests. The e2e run points it at `e2e/fake-groq.ts` |
| `KAPSO_INBOX_EMBED_URL` | Kapso's inbox at `/staff`, from `pnpm inbox:embed`. It holds a token: never log it or render it outside the staff session |
| `STAFF_PASSWORD` | The shared password for `/staff` (12+ characters) |
| `STAFF_SESSION_SECRET` | Signs staff session cookies (32+ characters, `openssl rand -hex 32`). Rotating it, or the password, signs everyone out |
| `CHAT_COOKIE_SECRET` | Signs the web chat's `fd_conv` cookie (32+ characters). Rotating it starts every visitor on a new conversation |
| `GLOBAL_DAILY_TURN_CAP` | Optional. Agent turns per UTC day for everyone together, default 250 |
| `CRON_SECRET` | Vercel's daily cron sends it to `/api/cron/retention` (16+ characters, `openssl rand -hex 32`). Set it in Vercel before the first run |

### WhatsApp in development

Kapso needs a public URL for webhooks, so run the app behind a Cloudflare quick tunnel.

1. `pnpm db:migrate && pnpm db:seed` against `DATABASE_URL`.
2. `pnpm dev --port 3000`, and in another terminal `cloudflared tunnel --url http://localhost:3000`. It prints an `https://<name>.trycloudflare.com` URL, which changes on every run.
3. Point the number's webhook at the tunnel and make sure it is active, from the Kapso dashboard or with the integrate-whatsapp skill's script (`scripts/list.js --phone-number-id <id>` shows the webhook id):
   ```sh
   cd .claude/skills/integrate-whatsapp
   KAPSO_API_BASE_URL=https://api.kapso.ai KAPSO_API_KEY=$(grep '^KAPSO_API_KEY=' ../../../.env.local | cut -d= -f2-) \
     node scripts/update.js --phone-number-id <KAPSO_PHONE_NUMBER_ID> --webhook-id <webhook-id> \
     --url https://<name>.trycloudflare.com/api/webhooks/kapso --active true
   ```
   Leave buffering off.
4. Message the demo number from a phone. `curl -X POST <url>/api/webhooks/kapso` with no signature should return 401.

The site also works from a phone at the tunnel URL or the Mac's local network address (`http://192.168.x.x:3000`).
`allowedDevOrigins` in `next.config.ts` lets those origins load the dev scripts; any other host needs an entry there, or the page renders but no button works.

Kapso's test button sends `"test": true` deliveries. They are acknowledged and dropped, so they never reach the agent.

### Staff inbox

`/staff` shows Kapso's inbox for the demo number next to a list of conversations with their owner.
A reply from the inbox takes the conversation over from the agent; "Hand back to AI", or Kapso ending the conversation, gives it back.

1. Create an embed per environment, allowed only from that environment's origin:
   ```sh
   pnpm inbox:embed --origin http://localhost:3000 --write-env .env.local
   ```
   Kapso returns the embed URL, which carries a token, once. The script appends it to the env file as `KAPSO_INBOX_EMBED_URL` and prints only the embed id, status and origins.
   Without `--write-env` it writes the URL to an owner-only file in `tmp/` instead.
2. Restart the server and sign in at `/staff`.
   From any other origin (even `http://127.0.0.1:3000`) the browser refuses to frame the inbox.
3. To rotate or revoke, run `pnpm inbox:embed --revoke <embed-id>`, delete the `KAPSO_INBOX_EMBED_URL` line, and create a new embed.

The URL is only rendered inside the session-checked part of `/staff`; never log it or put it in a public page.

### Limits, the reply window and retention

`checkGuards` in `src/lib/guards.ts` runs before every model call, on both channels, in this order:

1. A person owns the conversation: the message is kept for them, with no reply.
2. An image, sticker, location or other non-text message: the fixed reply "I can only read text for now."
3. Everyone together has used `GLOBAL_DAILY_TURN_CAP` turns today (UTC): "The demo is resting for today. Try again tomorrow."
4. The contact has used 20 turns in the last hour or 60 today (UTC), across both channels: "You've hit the demo limit. Try again in a bit."

A limit reply goes out once per window; later messages are kept with no reply.
Reactions get nothing at all, and the model reads at most 1,000 characters of one message.
Each turn that calls the model writes a `turns` row with its token counts, and only those rows count toward the limits.

WhatsApp replies are only sent within 24 hours of the customer's last message.
A reply ready after that is stored as `blocked` with the reason, and `/c` and `/staff` show the time left or "Window closed".

Vercel runs `GET /api/cron/retention` daily at 21:00 UTC (`vercel.json`).
It deletes conversations with no activity for 7 days, with their messages, bookings, link codes and turns, then contacts left without a conversation, then webhook events finished or failed more than 7 days ago.
To run it by hand: `curl -H "Authorization: Bearer $CRON_SECRET" <url>/api/cron/retention`.
Kapso keeps its own copy of WhatsApp messages, outside this job.

### Production

Production runs on Vercel (team `jubayer-al-mamuns-projects`, project `frontdesk`, region `iad1`) against the Neon project's default branch, `production`.
The `dev` branch is for local work only.
Production answers on the Triplone number through its own Kapso webhook and inbox embed, both for `https://frontdesk.jubayeramb.com`; local development uses Kapso's sandbox number, so the two never answer the same message.

- CI's `migrate` job runs `pnpm db:migrate` on every push to `main` once the checks pass, with the `PRODUCTION_DATABASE_URL` repository secret.
  It needs nothing else: `migrate.ts` and `seed.ts` only read the database variables.
- Vercel promotes a production deployment only after that job is green (Deployment Checks), so new code never meets an old schema.
- Only `main` deploys: `git.deploymentEnabled` in `vercel.json` turns off every other branch, since previews would need a database of their own.
- Production env vars live in Vercel only.
  `.env.production.local` (git-ignored) holds them locally, and `scripts/push-prod-env.sh` pushes them without printing values.
- Seed production by hand once: `DATABASE_URL=<production url> pnpm db:seed`.

### Next.js 16 notes

- `cacheComponents` is on. Anything that reads cookies, search params or the session goes in a component inside `<Suspense>`; the page and layout around it stay static.
- Never render a form inside a Suspense fallback. The fallback copy is what people use before hydration, and its action state is thrown away.
- Session checks call `await connection()` before reading the clock, so they never run during prerendering.

## Architecture rules

- **The agent core is channel-agnostic.** `src/lib/agent` returns `AgentReply[]` and never imports a channel adapter. The only channel-aware input is a one-line hint in the prompt.
- **Adapters render and send.** `src/lib/channels` turns `AgentReply[]` into what a channel supports (buttons, lists, numbered text, no markdown on WhatsApp) and sends it. Nothing else calls Kapso's send API.
- **Prices come only from the database through tools.** The model never states a price or an option that a tool did not return. A presenter builds choice replies from tool results.
- **Webhooks are verified, deduped, and processed asynchronously in order.** Verify the HMAC on the raw body, store the event once by `event_type:message.id`, return 200 fast, then drain each customer's events one at a time in `after()`. A claim takes a transaction-scoped advisory lock on the customer, so two workers never start at once. A failed event is retried by the same drain after 5 seconds, then 10, and marked failed after 3 attempts; a retried message that is already stored gets the turn or the sends its first attempt did not finish, never a second reply.
- **Every outbound send is stored before it goes out.** The row gets a nonce and `pending`, then the WhatsApp id or the error. `deliverTurn` is the only path from replies to a channel.
- **Ownership is stored on the conversation.** The agent never replies while a human owns it. Hand-back or Kapso ending the conversation returns it to the agent. `transition()` in `src/lib/ownership.ts` is the only code that changes the owner, and it records why.
- **An outbound message we never sent is a person in the inbox.** Kapso's `message.sent` cannot tell inbox replies from our sends, so the message id decides; an unknown id waits up to 15 seconds if one of our sends is still waiting for its id.
- **Free-form WhatsApp sends respect the 24-hour window.** `replyPolicy` decides, not the caller, and `deliverTurn` checks it when the turn is ready.
- **Guards run before the model.** `checkGuards` is the only place that decides whether a turn runs, and refused turns never count toward a limit.
- **The agent stays scoped to Triplone Tours.** It refuses unrelated requests.
- **Tools do the math.** Tools take raw inputs (tour, travelers, departure id) and compute totals in code. The model never adds or multiplies.
- **A booking needs the customer's own pick.** `bookDeparture` books only a departure the customer tapped, chose by number, or named by day and month in their latest message. The model's reading of anything else books nothing and offers the departures again.
- **A price guard checks every reply.** Any currency amount that no tool returned this turn, and that isn't the stored quote or booking, replaces the reply with one built from the quote.
- **Model failover is in code.** `withFallback` moves from `openai/gpt-oss-120b` to `openai/gpt-oss-20b` on a 429, 5xx or network error, or when Groq could not parse the model's own output, with SDK retries off. Every call runs at temperature 0.2. If both fail, the customer gets the busy reply.
- **The model sees 20 messages.** Older context lives in the conversation's `state` (latest quote and booking), which goes into the system prompt.
- **The business side stays minimal.** Tours, a per-person price in BDT, departures and bookings. Spend effort on the Kapso and agent parts, not on tour operations.

## OpenSpec workflow

All work is tracked as OpenSpec changes in `openspec/changes/`.

- Every feature goes `/opsx:propose` → `/opsx:apply` → `/opsx:verify` → `/opsx:archive`.
- The checkboxes in each change's `tasks.md` are the tracker. Tick a box as soon as that task is verified.
- `openspec list` shows progress across changes.
- Never write code for work that has no change. If the work is not in a change, propose one first.
- `pnpm spec:validate` must pass before archiving and in CI.

## Testing rules

- **Reproduce bugs end to end first.** Run the real flow before changing code. A fix written from reading the code usually treats a symptom.
- **Test against a real phone before sharing.** WhatsApp rendering, the reply window, and handoff only prove themselves on a real device.
- **Fix lint warnings and flaky tests on sight,** even when they are unrelated to the current change.
- Unit tests sit next to the code as `*.test.ts`. Shared fixtures (real Kapso payloads) go in `test/fixtures/`. E2E specs go in `e2e/`.
- Tests that call the real model are opt-in with `LIVE_LLM=1`. The default suite uses the AI SDK mock model.

## Secrets

- Never commit `.env` files. Only `.env.example` is tracked, with placeholder values.
- Never log tokens, webhook secrets, or phone numbers in full. Mask phone numbers to the last 4 digits.
- Add every new variable to `src/env-schema.ts` and `.env.example` in the same change.

## Clean-room rule

The repo and the write-up contain no code, model names, file paths, or internal stories from the author's employer.
Everything here is written from scratch.

## Git

- Conventional commits with a lowercase imperative subject and no trailing period: `feat: add quote tool`.
- No co-author trailers.
- No mention of AI, assistants, or generated code in commits, PRs, comments, or docs.
- Never run `git config user.*`.

## Public identity

Ask before adding any name, email, link, social handle, or byline.
Do not infer them from git config or anywhere else.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
