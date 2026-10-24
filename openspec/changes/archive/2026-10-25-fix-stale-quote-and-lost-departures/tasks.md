# Tasks

## 1. Fixes

- [x] 1.1 Remove the quote from the state when a booking succeeds, and verify a tool test that a second pick without a new quote books nothing and the first booking stays in the state
- [x] 1.2 Clear only tour options when a quote comes in, and verify tool tests that departures survive a quote and tour options do not
- [x] 1.3 Offer the quoted tour's departures when a reply asks for a departure without listing them, strip date lists from the text, and verify unit and turn tests plus a live replay of the phone conversation (4 of 4 runs offered departures)
- [x] 1.4 Remove option ids from every reply, and verify unit tests with the reply seen in a live run
- [x] 1.5 Tell customers plainly that bookings cannot be changed or cancelled (prompt rule and tool description), and verify a live replay of cancel, move and change-travelers requests (6 of 6 runs answered plainly with no dates)
- [x] 1.6 Put the quote line first when a quoting turn leaves out the total, and verify unit tests with the reply seen in a live replay
- [x] 1.7 On a real phone, book a tour, then pick another departure, and verify the agent asks for the travelers; ask to book a tour by name and verify the departures come as options

## Workflow follow-up

- Run `/opsx:verify`, then `/opsx:archive`.
