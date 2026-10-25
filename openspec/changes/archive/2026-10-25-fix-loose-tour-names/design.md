# Design

## Context

`computeQuote` and `offerDepartures` look a tour up by exact slug.
The prompt tells the model to pass the tour "exactly as the customer said", which invites free text, while the schema asks for a slug.

## Decisions

`matchTour(tours, text)` lowercases the text, splits it into words on anything that is not a letter or digit, and returns the tour whose slug equals the whole text, or else the single tour whose slug is one of the words.
Several matches or none mean unknown, so the model asks the customer rather than the tool guessing.
Inactive tours still match, so the existing "not taking bookings" message keeps working.

Alternative: fuzzy matching on names (edit distance).
More forgiving, but it can turn a typo into the wrong tour and a wrong price, which is worse than asking.

The currency rewrite runs on the reply text before the price guard, so the guard sees ৳ amounts; the guard's pattern also learns ₹ for any text that reaches it another way.

## Risks / Trade-offs

- [A future slug that is a common word] → Slugs are place names; a new tour picks a distinct slug.
