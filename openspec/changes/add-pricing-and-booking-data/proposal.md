# Proposal

## Why

The agent must quote what the business charges today, not what a prompt said last month.
Keeping prices in Postgres, editable by staff and versioned, is what lets a test prove that a quote came from a tool call and not from the model's memory.

## What Changes

- Add pricing tables (`services`, `price_rules`, `add_ons`, `price_list`) with a seed script for Mopwell's default prices.
- Add a pure quote calculation and a database-backed price list loader.
  Every quote carries the price list version it was computed from.
- Add slot generation (next 7 days, 9:00 and 13:00 Austin time, minus booked and past slots) and a booking function that cannot double-book a slot.
- Add `/staff/pricing`, where staff edit prices.
  Every save bumps the price list version.
- Add the `/staff` password gate, because `/staff/pricing` is the first staff page and must never be public.
- Add a local Postgres setup for tests that runs the same Neon serverless driver the app uses.

Out of scope: the agent and its tools (add-agent-core), the inbox embed and conversation list on `/staff` (add-human-handoff), calendar integrations, taxes and discounts.

Phase 2.
Depends on spike-kapso-and-groq only for ordering; nothing here needs its findings.

## Capabilities

### New Capabilities

- `pricing`: the price list, quote calculation, price list versioning, and staff price edits.
- `booking-slots`: available slot generation and booking a slot.
- `staff-access`: the password gate in front of every `/staff` page.

### Modified Capabilities

None.

## Impact

- New: `src/db/schema.ts` tables and the first migrations in `drizzle/`, `src/lib/pricing/`, `src/lib/slots/`, `src/app/staff/`, `src/proxy.ts`, `docker-compose.yml`.
- New env vars: `STAFF_PASSWORD`, `STAFF_SESSION_SECRET`.
- `pnpm db:seed` loads real data.
  CI gains a Postgres service.
