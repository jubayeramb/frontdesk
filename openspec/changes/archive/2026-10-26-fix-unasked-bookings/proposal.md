# Proposal

## Why

On a real phone, the meaningless message "M2", sent after the Sundarbans departures were listed, booked TR-00003 for the second departure.
A replay of quote, dates and "M2" on `openai/gpt-oss-120b` booked TR-00004 in one of three runs, and asked what the customer meant in the other two.
`bookDeparture` books whatever departure the model passes, so whether a booking happens is the model's call, and the model runs at Groq's default temperature of 1.
The same history gets different answers, and one of them is a booking the customer never asked for.

## What Changes

- `bookDeparture` books only the departure the customer's latest message picked: a tapped or numbered option with that departure's id, or text that names that departure's day and month.
- Otherwise it books nothing, tells the model the customer has not picked that departure, and offers the current departures so the customer can tap one.
- The agent's model calls run at temperature 0.2.
- A bare departure id in a reply ("sundarbans:2026-10-29"), seen in a replay of this fix, is written as its date.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

front-desk-agent

## Impact

- `src/lib/agent/tools.ts`: the booking tool checks the pick before booking.
- `src/lib/agent/run-turn.ts`: passes the customer's latest message to the tools, and sets the temperature.
- `src/lib/agent/listed-options.ts`: `dropOptionIds` also rewrites bare departure ids.
- `src/lib/departures/departures.ts`: a helper that tells whether text names a departure's date.
