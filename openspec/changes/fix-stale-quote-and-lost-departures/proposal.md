# Proposal

## Why

A real-phone run on WhatsApp found two agent bugs.
A customer picked a Sylhet departure and was booked for 3 travelers they never mentioned in that chat: the quote from an earlier booking, days before, was still stored and was used again.
A customer asked to book the Bandarban tour and got its price and dates in text, but no options to pick from: quoting in the same turn threw away the departures listed just before.
On the next try the model did not list departures at all: it copied the dates from its own earlier reply, and a replay showed it doing so in 1 run of 3.
One replay reply also showed internal option ids ("Fri 30 Oct (id: sylhet:2026-10-30)").
Asked to cancel, the agent refused as if the request were off-topic; asked to move a booking or change its travelers, it offered dates, and picking one would have made a second booking.
Some replies after a quote left out the price.

## What Changes

- A quote is used for one booking: a successful booking removes it from the conversation state, so the next booking needs a new quote and the travelers are asked again.
- Quoting a tour drops only tour options offered earlier in the turn, never departures.
- A reply that asks for a departure without listing them this turn gets the quoted tour's real departures as options, and a list of dates in brackets or after a colon is removed from its text.
- Option ids are removed from every reply.
- Until add-human-handoff routes them to a person, the agent says plainly that it cannot change or cancel bookings, and never offers a new booking instead.
- A turn that quotes always shows the total: if the reply leaves it out, the quote line goes first.
- The prompt asks for listDepartures in the turn dates are offered, listTours only when asked, and the total whenever a quote is given.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `front-desk-agent`: a booking uses up its quote, and departures survive a quote in the same turn.

## Impact

- `src/lib/agent/tools.ts` (`getQuote`, `bookDeparture`, and the turn record), `src/lib/agent/run-turn.ts`, `src/lib/agent/prompt.ts`, and a new `src/lib/agent/date-lists.ts`.
- `updateState` in `src/lib/conversations/store.ts` can remove keys in the same update.
- Conversations that already hold a used quote keep it until their next booking or quote; the demo data has a handful.
