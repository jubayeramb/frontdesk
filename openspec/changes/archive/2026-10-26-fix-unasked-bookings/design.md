# Design

## Context

A booking is the one tool call that writes something the customer has to live with.
Today the prompt says "book only after the customer picked a departure", and the model alone decides what a pick is.
Taps already reach the turn as a `choiceId`, and a numbered reply on WhatsApp is mapped to the option's id before the turn runs.

## Decisions

The tools get the customer's latest message, its text and its `choiceId`, through `TurnContext`.
A retried turn reads both from the stored message.

`bookDeparture` books only when the message picked the departure it was given:

- the `choiceId` equals the departure id, or
- the text names that departure's date: its day number next to its month, either way round, with the month short or long and an optional "st", "nd", "rd" or "th" ("1 Nov", "Nov 1st", "1st November").

Anything else books nothing.
The tool answers that the customer has not picked this departure and offers the tour's current departures, so the customer gets the buttons and one tap books.

A weekday alone ("Sunday") is not a pick: within 14 days it can name two departures.
"Yes" after "Shall I book Sun 1 Nov?" is not a pick either; the customer taps the date instead.
That costs one tap in a rare flow, and it never books a date the customer did not name.

Temperature 0.2 for every model call: low enough that the same history gets the same tools, while the wording still varies a little.

Alternative: tell the model harder in the prompt.
The prompt already says it, and the replay shows the model ignoring it, so the rule has to live in code.

## Risks / Trade-offs

- [A customer types a date in another form, such as "01/11"] → They get the departure buttons and tap one.
- [Lower temperature makes the fallback model repeat a bad answer more consistently] → The live tests and the replay run on both models.
