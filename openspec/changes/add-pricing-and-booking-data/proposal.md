# Proposal

## Why

The agent must quote what the business charges today, not what a prompt said last month.
Keeping tour prices in Postgres, editable by staff and versioned, is what lets a test prove that a quote came from a tool call and not from the model's memory.
The business side stays deliberately small: the point of the demo is Kapso and the agent, not tour operations.

## What Changes

- Add a `tours` table (three Triplone Tours packages with a per-person price in BDT) and a `price_list` version, with a seed script.
- Add a pure quote calculation (price per person times travelers) and a database-backed loader. Every quote carries the price list version it was computed from.
- Add departures (each tour leaves on fixed weekdays, for the next 14 days, Asia/Dhaka time) and a function that stores a booking.
- Add `/staff/pricing`, where staff edit tour prices. Every save bumps the price list version.
- Add the `/staff` password gate, because `/staff/pricing` is the first staff page and must never be public.
- Add a local Postgres setup for tests that runs the same Neon serverless driver the app uses.

Out of scope: group discounts, add-ons, seat capacity, cancellations, payments, calendar integrations.
The agent and its tools (add-agent-core) and the inbox embed on `/staff` (add-human-handoff) are separate changes.

Phase 2. Depends on nothing beyond the repo setup.

## Capabilities

### New Capabilities

- `pricing`: tour prices, quote calculation, price list versioning, and staff price edits.
- `tour-departures`: which departures are offered and booking one.
- `staff-access`: the password gate in front of every `/staff` page.

### Modified Capabilities

None.

## Impact

- New: `src/db/schema.ts` tables and the first migrations in `drizzle/`, `src/lib/pricing/`, `src/lib/departures/`, `src/app/staff/`, `src/proxy.ts`, `docker-compose.yml`.
- New env vars: `STAFF_PASSWORD`, `STAFF_SESSION_SECRET`.
- `pnpm db:seed` loads real data. CI gains a Postgres service.
