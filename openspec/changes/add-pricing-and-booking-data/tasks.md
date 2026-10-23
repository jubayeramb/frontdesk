# Tasks

## 1. Test database

- [ ] 1.1 Add `docker-compose.yml` with `postgres:17` and Neon `wsproxy`, plus `db:test:up` and `db:test:down` scripts, and verify `pnpm db:test:up` starts both and `psql` connects
- [ ] 1.2 Add a Vitest setup for integration tests (`*.int.test.ts`, separate `test:int` script) that points the Neon driver at the local proxy, migrates a fresh database and truncates between tests; verify a trivial `select 1` test passes
- [ ] 1.3 Add the Postgres and wsproxy services to CI and run `test:int`; verify the workflow passes on a branch push

## 2. Pricing

- [ ] 2.1 Add the `services`, `price_rules`, `add_ons` and `price_list` tables, generate the migration, and verify `pnpm db:migrate` applies it to the test database
- [ ] 2.2 Write `src/db/seed-data.ts` and the idempotent seed, and verify an integration test that seeds twice finds no duplicates and keeps an edited price
- [ ] 2.3 Implement pure `computeQuote` and verify unit tests for every scenario in the pricing spec (line items, exact totals, out-of-range counts, inactive add-ons)
- [ ] 2.4 Implement `getPriceList(db)` and verify an integration test reads the seeded list with its version
- [ ] 2.5 Implement `updatePrices(db, changes)` (zod-validated, one transaction, bumps the version) and verify integration tests for a valid save, an invalid amount, and that the version rises by exactly one

## 3. Slots and bookings

- [ ] 3.1 Implement pure `listSlots(now, booked)` and verify unit tests for a normal week, a started slot, a booked slot, and both DST transitions
- [ ] 3.2 Add the `bookings` table (`slot_start` unique, quote snapshot as jsonb), and implement `bookSlot(db, ...)`; verify integration tests for success, a concurrent double booking (exactly one wins), and an invalid slot

## 4. Staff access and pricing page

- [ ] 4.1 Add `STAFF_PASSWORD` and `STAFF_SESSION_SECRET` to `src/env-schema.ts` and `.env.example`, and verify the env unit test covers them
- [ ] 4.2 Implement the session cookie helpers (sign, verify, expiry) and verify unit tests for a valid cookie, a tampered one, an expired one, and one signed with a rotated secret
- [ ] 4.3 Add `src/proxy.ts`, the sign-in page and sign-out, and verify a Playwright test that `/staff/pricing` redirects to sign-in, a wrong password stays put, and the right one lands on pricing
- [ ] 4.4 Build `/staff/pricing` with shadcn form controls that save through a server action calling `updatePrices` with a session re-check; verify a Playwright test that edits a price and sees the new value and version after reload
- [ ] 4.5 Check `/staff/sign-in` and `/staff/pricing` at phone width and in dark mode with Playwright screenshots, and fix anything misaligned
- [ ] 4.6 Document `db:test:up`, `test:int` and the staff env vars in `AGENTS.md`, and verify the documented commands run as written

## Workflow follow-up

- Run `/opsx:verify`, then `/opsx:archive`.
