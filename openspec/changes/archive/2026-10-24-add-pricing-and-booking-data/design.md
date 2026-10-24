# Design

## Context

The repo has Drizzle wired to the Neon serverless WebSocket `Pool` and an empty schema.
No route outside `/` exists yet.
Next.js 16 renamed `middleware.ts` to `proxy.ts`; check `node_modules/next/dist/docs/` before writing it.

## Goals / Non-Goals

**Goals:**
- Just enough business data for the agent to quote and book from the database.
- Pricing and departure logic as pure functions, cheap to test.
- One database-backed integration test path that runs locally and in CI with the production driver.

**Non-Goals:**
- Group discounts, add-ons, seat capacity, cancellations or payments.
- Per-staff accounts or roles. One shared password is enough for a demo.

## Decisions

### Data model

- `tours(id, slug, name, summary, days, price_per_person_bdt, departure_weekdays int[], active, updated_at)`.
- `price_list(id = 1, version, updated_at)`: a single row.
- `bookings(id, conversation_id, tour_id, departs_on date, travelers, quote jsonb, created_at)`.

Amounts are whole taka in integer columns; nobody prices a tour in poisha.
Seed tours: Sundarbans 3-day boat tour (Thu, Sun), Sylhet tea gardens 2-day (Fri), Bandarban hills 3-day (Wed, Sat), with made-up prices.

### Quote

`computeQuote(priceList, { tourSlug, travelers })` is pure (it needs the whole list to reject unknown and inactive tours) and returns `{ ok: true, quote } | { ok: false, error }`, where `quote` is `{ tour, pricePerPersonBdt, travelers, totalBdt, priceListVersion }`.
`getPriceList(db)` reads tours and the version in one transaction, so a quote never mixes two versions.
Errors are values, not exceptions, because the agent tool hands them to the model as data.
Formatting (`৳58,000`) lives in one helper used by the agent and the pages.

### Versioning

The pricing save action runs one transaction: update the edited tours, then `UPDATE price_list SET version = version + 1`.

### Seed

Upserts on tour slug with `ON CONFLICT (slug) DO NOTHING`, so re-running never overwrites staff edits.
Default data lives in `src/db/seed-data.ts` so tests import the same numbers.
The package has no `"type": "module"`, so keep `main()` wrapped as it is, or name scripts `.mts`.

### Departures

`listDepartures(tour, now)` is pure: dates in the next 14 days whose weekday is in `departure_weekdays`, in Asia/Dhaka, skipping anything that leaves within 48 hours.
Bangladesh has no daylight saving, so a fixed UTC+6 offset is correct and no timezone library is needed.
A departure's id is `<tour-slug>:<YYYY-MM-DD>`, so a button id round-trips without lookups.
`bookDeparture` re-checks the departure is offered and inserts the booking. There is no capacity check.

### Staff gate

A small sign-in page posts the password to a server action that compares it in constant time with `STAFF_PASSWORD`, then sets an `httpOnly`, `secure`, `sameSite=lax` cookie holding an expiry and an HMAC of that expiry keyed by `STAFF_SESSION_SECRET` plus the password.
`src/proxy.ts` checks the cookie on `/staff/:path*` and redirects to `/staff/sign-in?next=...`.
Server actions re-check the session themselves, because the proxy is not a security boundary for actions.
Rotating either secret invalidates every session.

Alternative: HTTP Basic auth. Less code, but no sign-out and an ugly browser prompt on a page a reviewer will open.

### Test database

`docker-compose.yml` runs `postgres:17` plus Neon's `wsproxy` container, and the test setup points `neonConfig` at the local proxy.
That way tests exercise the exact driver and transaction behavior production uses.
CI runs the same two containers as services.

Alternatives: a Neon branch per CI run (needs a Neon API key in CI), or `node-postgres` for tests (a different driver than production).

## Risks / Trade-offs

- [`wsproxy` setup is fiddly] → Document it in `AGENTS.md`, and keep a `pnpm db:test:up` script.
- [Shared password leaks] → Rotate `STAFF_PASSWORD`; every session dies with it.
- [No capacity means unlimited bookings per departure] → Fine for a demo with no real bookings; the banner says so.

## Migration Plan

First migration, nothing to migrate from.
Deploy runs `pnpm db:migrate` then `pnpm db:seed`.
