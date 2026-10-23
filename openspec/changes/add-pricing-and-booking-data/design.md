# Design

## Context

The repo has Drizzle wired to the Neon serverless WebSocket `Pool` and an empty schema.
No route outside `/` exists yet.
Next.js 16 renamed `middleware.ts` to `proxy.ts`; check `node_modules/next/dist/docs/` before writing it.

## Goals / Non-Goals

**Goals:**
- Pricing and slot logic as pure functions with no database access, so they are cheap to test exhaustively.
- One database-backed integration test path that runs locally and in CI with the production driver.

**Non-Goals:**
- Per-staff accounts or roles.
  One shared password is enough for a demo.
- Editing slot times or blocking days.
  Slots are fixed by code.

## Decisions

### Price model

- `services(id, slug, name, active)`: `standard`, `deep`.
- `price_rules(id, service_id, kind, bedrooms, amount_cents)`, where `kind` is `base` (one row per bedroom count 1 to 5) or `extra_bathroom` (one row per service, charged per bathroom beyond the first).
- `add_ons(id, slug, name, amount_cents, active)`.
- `price_list(id = 1, version, updated_at)`: a single row.

Alternative: one JSON document for the whole price list.
Simpler to version, but harder to edit one field safely and impossible to constrain in SQL.

### Quote shape

`computeQuote(priceList, input)` is pure and returns `{ ok: true, quote } | { ok: false, error }`, where `quote` is `{ lineItems: { label, amountCents }[], totalCents, priceListVersion }`.
`getPriceList(db)` reads all four tables in one transaction so a quote never mixes two versions.
Errors are values, not exceptions, because the agent tool will hand them to the model as data.

### Versioning

The pricing save action runs one transaction: update the edited rows, then `UPDATE price_list SET version = version + 1`.
`price_list` is the only place the version lives.

### Seed

Upserts on stable slugs (`ON CONFLICT (slug) DO NOTHING`), so re-running never overwrites staff edits.
Default prices go in `src/db/seed-data.ts` so tests can import the same numbers.

### Slots

`listSlots(now, booked)` is pure and builds local times with `TZDate` from `@date-fns/tz` in the `America/Chicago` zone.
Alternative: hand-rolled `Intl.DateTimeFormat` offset math.
No dependency, but DST edges are exactly where hand-rolled code goes wrong.
Slot ids are the ISO start instant, so a button id round-trips without lookups.
Booking relies on `bookings.slot_start UNIQUE`, and an insert conflict maps to `{ ok: false, reason: "taken" }`.

`bookings.conversation_id` is a plain `uuid` column in this change.
Add-agent-core adds the foreign key once `conversations` exists.

Alternative: check-then-insert inside a transaction.
The unique constraint is simpler and correct under races without locks.

### Staff gate

A small sign-in page posts the password to a server action that compares it in constant time with `STAFF_PASSWORD`, then sets an `httpOnly`, `secure`, `sameSite=lax` cookie holding an expiry and an HMAC of that expiry keyed by `STAFF_SESSION_SECRET` plus the password.
`src/proxy.ts` checks the cookie on `/staff/:path*` and redirects to `/staff/sign-in?next=...`.
Server actions re-check the session themselves, because the proxy is not a security boundary for actions.
Rotating either secret invalidates every session.

Alternative: HTTP Basic auth.
Less code, but no sign-out and an ugly browser prompt on a page a reviewer will open.

### Test database

`docker-compose.yml` runs `postgres:17` plus Neon's `wsproxy` container, and the test setup points `neonConfig` at the local proxy.
That way tests exercise the exact driver and transaction behavior production uses.
CI runs the same two containers as services.

Alternatives: a Neon branch per CI run (realistic, but needs a Neon API key in CI and network for every test run), or swapping in `node-postgres` for tests (fast, but a different driver than production).

## Risks / Trade-offs

- [`wsproxy` setup is fiddly] → Document it in `AGENTS.md`, and keep a `pnpm db:test:up` script so nobody has to remember the flags.
- [Shared password leaks] → Rotate `STAFF_PASSWORD`; every session dies with it.
  The inbox embed added later is also revocable.
- [Austin time math off by an hour around DST] → Explicit DST scenarios in the slot tests, with a fixed `now`.

## Migration Plan

First migration, nothing to migrate from.
Deploy runs `pnpm db:migrate` then `pnpm db:seed`.
