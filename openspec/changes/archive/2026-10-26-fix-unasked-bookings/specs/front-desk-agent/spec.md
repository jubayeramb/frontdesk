## MODIFIED Requirements

### Requirement: Booking confirms only what was stored
The agent SHALL confirm a booking only after the booking tool reports success, and SHALL offer the current departures when the tool reports a departure is unavailable.
A quote SHALL be used for one booking only: a successful booking removes it, so a later booking needs a new quote.

#### Scenario: Departure no longer offered
- **WHEN** the booking tool returns "unavailable" because the departure is now within 48 hours
- **THEN** the agent says so and offers the current departures

#### Scenario: Second booking in the same conversation
- **WHEN** a customer booked the Sylhet tour for 3 travelers, and later picks another Sylhet departure without a new quote
- **THEN** no booking is made and the agent asks how many people are travelling

### Requirement: Option ids never reach the customer
The system SHALL remove option ids written as "(id: …)" from every reply, and SHALL write a bare departure id as that departure's date.

#### Scenario: Model copies an id from its history
- **WHEN** the model replies "Booked Fri 30 Oct (id: sylhet:2026-10-30) for 2."
- **THEN** the customer sees "Booked Fri 30 Oct for 2."

#### Scenario: Model writes a bare departure id
- **WHEN** the model replies "Let me know which departure you'd like (e.g., sundarbans:2026-10-29)."
- **THEN** the customer sees "Let me know which departure you'd like (e.g., Thu 29 Oct)."

## ADDED Requirements

### Requirement: Bookings need the customer's pick
The booking tool SHALL book only the departure the customer's latest message picked: an option with that departure's id, tapped or chosen by number, or text that names that departure's day and month.
For any other message it SHALL book nothing and offer the current departures.

#### Scenario: Meaningless text after the departures
- **WHEN** the Sundarbans departures were offered and the customer writes "M2"
- **THEN** no booking is made, even if the model calls the booking tool for the second departure
- **AND** the customer is offered the current departures

#### Scenario: Customer taps a departure
- **WHEN** the customer taps "Sun 1 Nov" in the departures offered after a quote
- **THEN** that departure is booked

#### Scenario: Customer names the date
- **WHEN** the customer writes "book the 1st of November" and the model books the Sun 1 Nov departure
- **THEN** that departure is booked


### Requirement: Low model temperature
Every model call in a turn SHALL run at temperature 0.2.

#### Scenario: Turn runs
- **WHEN** a turn calls the model
- **THEN** the call sets temperature 0.2
