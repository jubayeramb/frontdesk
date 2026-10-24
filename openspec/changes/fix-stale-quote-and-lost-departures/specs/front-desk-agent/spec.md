# Spec Delta

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

## ADDED Requirements

### Requirement: Departures survive a quote in the same turn
When one turn lists a tour's departures and also quotes that tour, the turn SHALL still return the departures as a `choices` reply.
Only tour options offered earlier in the turn are dropped by a quote.

#### Scenario: Customer asks to book a tour by name
- **WHEN** a customer with a stated group size says "we want to book the Bandarban tour" and the agent lists departures and quotes in that turn
- **THEN** the reply has the quote and the Bandarban departures as options

### Requirement: Departures the model mentions are always offered
When a reply names dates or asks the customer to pick a departure or date, a quote exists, nothing was booked in the turn, and no departures were listed in the turn, the system SHALL offer the quoted tour's current departures as a `choices` reply.
When departures are offered, a list of dates in brackets or after a colon SHALL be removed from the reply text.

#### Scenario: Model copies dates from an earlier reply
- **WHEN** the model replies "Which departure (28 Oct, 31 Oct, 4 Nov, 7 Nov) would you like to book?" after quoting the Bandarban tour, without listing departures
- **THEN** the text reply is "Which departure would you like to book?" and the current Bandarban departures follow as options

#### Scenario: Model offers to show departures
- **WHEN** the reply after a quote is "Want to see departures?"
- **THEN** no departures are offered until the customer asks for them

#### Scenario: Booking confirmation names its date
- **WHEN** the turn booked a departure and the reply says "Booked for Sun 8 Nov"
- **THEN** no departures are offered

### Requirement: The agent does not change or cancel bookings
The agent SHALL say plainly that it cannot change or cancel a booking when asked, and SHALL not offer a new booking in place of the change.
add-human-handoff replaces the plain answer with a handoff to a person.

#### Scenario: Customer asks to move a booking
- **WHEN** a customer with a booking writes "can we move our booking to the next date instead?"
- **THEN** the agent says it cannot change bookings, and no departures are offered

### Requirement: A quote always shows its total
When a turn quotes a tour and nothing is booked in that turn, the reply SHALL state the quote's total; if the model's text leaves it out, the quote line SHALL come first.

#### Scenario: Model moves straight on to the departures
- **WHEN** the turn quoted the Bandarban tour for 2 and the model replies "Here are the upcoming departures."
- **THEN** the text reply starts with "Bandarban hills 3-day for 2 travelers: ৳12,000 per person, ৳24,000 total."

### Requirement: Option ids never reach the customer
The system SHALL remove option ids written as "(id: …)" from every reply.

#### Scenario: Model copies an id from its history
- **WHEN** the model replies "Booked Fri 30 Oct (id: sylhet:2026-10-30) for 2."
- **THEN** the customer sees "Booked Fri 30 Oct for 2."
