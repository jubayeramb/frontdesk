# Design

## Context

`getQuote` stores the quote in the conversation state, and `bookDeparture` books with whatever quote is stored (add-agent-core).
Nothing removed the quote after a booking, and the prompt tells the model to keep the travelers from the latest quote.
Within a turn, `getQuote` cleared `record.choices` so tour buttons looked up first would not linger after the customer named a tour (add-whatsapp-channel), but it cleared departures the same way.

## Goals / Non-Goals

**Goals:**
- Every booking is made at a quote the customer saw for that booking.
- A turn that lists departures always offers them.

**Non-Goals:**
- Quote expiry by time; a used-up quote is what went wrong, and prices are re-checked by version already.

## Decisions

### A booking removes the quote

On success, `bookDeparture` writes the booking and removes `quote` from the state in one update.
`updateState` takes keys to remove and applies them with the jsonb `-` operator in the same statement, so a booking can never be stored with its quote left behind.
The booking itself keeps the travelers and total, so the agent can still talk about it.

### The record knows what its choices are

`TurnRecord` gets `choicesOf: "tours" | "departures"`, set with the choices.
`getQuote` clears choices only when they are tours.

### Departures the model talks about are offered from code

The prompt now asks for listDepartures in the turn dates are offered, but the model still copies dates or asks "which departure?" without calling it now and then.
After the model's text, if the reply asks for a departure (it names a date, or says "which", "pick", "choose" or "select" before "departure" or "date"), no departures were listed and nothing was booked this turn, and a quote exists in the turn or the state, the turn runs the same `offerDepartures` the tool uses for the quoted tour.
Whenever departures are offered, a list of dates in brackets or after a colon is stripped from the text; dates inside a sentence stay, since cutting them would break the sentence.
Like the price guard, this keeps what the customer can pick grounded in the database instead of in the model's memory of an earlier reply.

### Ids are stripped from every reply

History shows the model each option as "label (id: …)", so it sometimes writes ids back.
`dropOptionIds` removes "(id: …)" from every reply, and a list line that ends in brackets still matches its option.

### Changes and cancellations, for now

A prompt rule says the agent cannot change or cancel bookings and must not offer a new booking instead, and the `bookDeparture` description says it only ever makes a new booking.
A live replay of three requests (cancel, move to the next date, change the travelers) answered all 6 runs with a plain "I can't change or cancel bookings" and no dates.
add-human-handoff turns this into a handoff to a person.

### The total is put back in code

The prompt asks for the total with every quote, but replays still left it out about one time in four.
`ensureQuoteTotal` puts `quoteText` before the reply when a turn quoted, nothing was booked, and the total is missing, the same line the price guard falls back to.

## Risks / Trade-offs

- [A customer who wants a second date for the same group is asked for the travelers again] → One extra question, against booking a number of people nobody confirmed.
- [An offer such as "Want to see departures?" could have triggered it too] → It does not: an offer lets the customer say no, so only a request to pick counts.
- [A reply that mentions dates for another reason gets departure options] → It needs a quote in the conversation and no booking in the turn, and the options are for the quoted tour, so they are relevant anyway.
