# Tasks

## 1. Conversation store

- [x] 1.1 Add `contacts`, `channel_identities` (unique channel plus external id), `conversations` (owner, owner_changed_at, kapso_conversation_id, wa_last_inbound_at, state jsonb) and `messages` (external_id unique nullable, client_nonce), plus the `bookings` foreign key; verify the migration applies on the test database
- [x] 1.2 Implement `src/lib/conversations/` (find or create by identity, append message, load window, read and write state), and verify integration tests for the identity, storage, window and state scenarios in the conversation-history spec

## 2. Model and tools

- [x] 2.1 Add `ai` and `@ai-sdk/groq`, `GROQ_API_KEY` in env schema and `.env.example`, and `src/lib/agent/model.ts` with `withFallback`; verify unit tests that a 429 and a 503 move to the next model, a 400 does not, and two failures return the busy result
- [x] 2.2 Implement the tools (`listTours`, `getQuote`, `listDepartures`, `bookDeparture`) with zod input schemas and the per-turn choices collector; verify unit tests that each tool returns data and pushes the expected `choices`
- [x] 2.3 Write the scoped system prompt and channel hints, and verify a unit test that the prompt stays under a fixed token budget

## 3. runTurn

- [x] 3.1 Implement `runTurn` with the history window, the presenter and the amount guard, and verify mock-model integration tests for every front-desk-agent scenario, including the off-topic refusal calling no tool
- [x] 3.2 Write the pricing proof test (seed, quote, edit price through `updatePrices`, quote again: new total, new version, old total absent) and verify it passes with the mock model
- [x] 3.3 Add the same pricing proof as an opt-in live test (`LIVE_LLM=1`) against Groq on both models and verify it passes; record tokens per turn in this design
- [x] 3.4 Add `pnpm agent:chat` (a terminal REPL on a local conversation) and verify a quote and a booking can be completed in it

## 4. Docs

- [x] 4.1 Document `agent:chat`, `LIVE_LLM` and the agent rules in `AGENTS.md`, and verify the commands run as written

## Workflow follow-up

- Run `/opsx:verify`, then `/opsx:archive`.
