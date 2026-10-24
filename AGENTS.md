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
| `pnpm spec:validate` | `openspec validate --all --strict` |

Copy `.env.example` to `.env.local` before running anything that touches the database.
`pnpm test:int` and `pnpm test:e2e` need `pnpm db:test:up` first; they never touch `DATABASE_URL`.

### Environment

| Variable | Used for |
|---|---|
| `DATABASE_URL` | Neon Postgres. Use the pooled connection string |
| `DATABASE_WS_PROXY` | Only for a local Postgres behind wsproxy, e.g. `localhost:5433/v1` |
| `STAFF_PASSWORD` | The shared password for `/staff` (12+ characters) |
| `STAFF_SESSION_SECRET` | Signs staff session cookies (32+ characters, `openssl rand -hex 32`). Rotating it, or the password, signs everyone out |

### Next.js 16 notes

- `cacheComponents` is on. Anything that reads cookies, search params or the session goes in a component inside `<Suspense>`; the page and layout around it stay static.
- Never render a form inside a Suspense fallback. The fallback copy is what people use before hydration, and its action state is thrown away.
- Session checks call `await connection()` before reading the clock, so they never run during prerendering.

## Architecture rules

- **The agent core is channel-agnostic.** `src/lib/agent` returns `AgentReply[]` and never imports a channel adapter. The only channel-aware input is a one-line hint in the prompt.
- **Adapters render and send.** `src/lib/channels` turns `AgentReply[]` into what a channel supports (buttons, lists, numbered text, no markdown on WhatsApp) and sends it. Nothing else calls Kapso's send API.
- **Prices come only from the database through tools.** The model never states a price or an option that a tool did not return. A presenter builds choice replies from tool results.
- **Webhooks are verified, deduped, and processed asynchronously in order.** Verify the HMAC on the raw body, store the event once by dedupe key, return 200 fast, then drain per conversation with `FOR UPDATE SKIP LOCKED`.
- **Ownership is stored on the conversation.** The agent never replies while a human owns it. Hand-back or Kapso ending the conversation returns it to the agent.
- **Free-form WhatsApp sends respect the 24-hour window.** `replyPolicy` decides, not the caller.
- **The agent stays scoped to Triplone Tours.** It refuses unrelated requests.
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
