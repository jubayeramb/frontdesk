# front-desk-agent Specification

## Purpose
Answers each customer message for Triplone Tours with replies grounded in live data, the same way on every channel.

## Requirements

### Requirement: Prices come only from the quote tool
The agent SHALL state a price only when that price was returned by the quote tool during the current turn or stored as the conversation's latest quote, and SHALL never state a price from memory.

#### Scenario: Customer asks for a price
- **WHEN** a customer with no quote yet asks "how much is the Sundarbans tour for 4 people?"
- **THEN** the agent calls the quote tool with those inputs
- **AND** the reply contains the tool's total and no other amount

#### Scenario: Missing details
- **WHEN** a customer asks "how much is a tour?" without saying which tour or how many people
- **THEN** the agent asks which tour and how many travelers instead of guessing a price

#### Scenario: Price changed between turns
- **WHEN** staff change a price after a quote and the customer asks for the quote again
- **THEN** the agent calls the quote tool again and the reply shows the new total and the new price list version

### Requirement: Choices come only from tool results
When the agent offers a set of options (tours or departures), the system SHALL build that `choices` reply from the tool result, with one option per returned item and ids that the tool accepts back.

#### Scenario: Offering departures
- **WHEN** the agent calls the departures tool and 4 departures are offered
- **THEN** the turn returns a `choices` reply with exactly those 4 departures as options

#### Scenario: Customer picks an option
- **WHEN** the next inbound message is the id of one of those options
- **THEN** the agent treats it as that choice without asking again

### Requirement: Booking confirms only what was stored
The agent SHALL confirm a booking only after the booking tool reports success, and SHALL offer the current departures when the tool reports a departure is unavailable.
A quote SHALL be used for one booking only: a successful booking removes it, so a later booking needs a new quote.

#### Scenario: Departure no longer offered
- **WHEN** the booking tool returns "unavailable" because the departure is now within 48 hours
- **THEN** the agent says so and offers the current departures

#### Scenario: Second booking in the same conversation
- **WHEN** a customer booked the Sylhet tour for 3 travelers, and later picks another Sylhet departure without a new quote
- **THEN** no booking is made and the agent asks how many people are travelling

### Requirement: Scoped to Triplone Tours
The agent SHALL only help with Triplone Tours' tours, quotes, bookings and contacting a person, and SHALL politely refuse anything else in one or two sentences.

#### Scenario: Off-topic request
- **WHEN** a customer asks the agent to write a poem or answer a general question
- **THEN** the agent declines briefly and says what it can help with
- **AND** no tool is called

### Requirement: Channel-neutral replies
A turn SHALL return an ordered list of replies, each one of `text`, `choices`, `handoff` or `link`, and SHALL produce the same replies for the same history regardless of channel, apart from wording the channel hint allows.

#### Scenario: Same question on two channels
- **WHEN** the same quote question is asked in a web conversation and a WhatsApp conversation with equal history
- **THEN** both turns call the same tools with the same inputs and return the same reply kinds

### Requirement: Model fallback and busy reply
The system SHALL retry a turn on the fallback model when the primary model is rate limited or fails with a server error, and SHALL return a fixed busy reply without stating any price when both fail.

#### Scenario: Primary rate limited
- **WHEN** the primary model returns a rate-limit error
- **THEN** the turn completes on the fallback model and the customer sees a normal reply

#### Scenario: Both models unavailable
- **WHEN** both models fail
- **THEN** the turn returns "We're busy right now.
  Try again in a minute."
- **AND** the failure is logged with the error class, not the message content

### Requirement: Tool failures do not leak
When a tool fails or returns a validation error, the agent SHALL tell the customer what it needs or that something went wrong, and SHALL never show a stack trace, SQL, or internal ids.

#### Scenario: Too many travelers
- **WHEN** the quote tool rejects 15 travelers
- **THEN** the agent says bookings take 1 to 10 travelers and asks again

### Requirement: Options are introduced, not repeated
When a turn offers options, the reply text SHALL lead into them without repeating them or describing how they are shown, since each channel shows them in its own way.
List lines in the reply that only repeat an option label SHALL be removed.

#### Scenario: Model lists the departures
- **WHEN** the model replies "These are the next departures for the Sylhet tour:" followed by "- Fri 6 Nov" and "- Fri 13 Nov", and those are the offered options
- **THEN** the text reply is "These are the next departures for the Sylhet tour." and the departures arrive only as options

#### Scenario: Customer asks what tours there are
- **WHEN** a customer asks which tours are available
- **THEN** the reply text does not mention buttons, tapping or where the options appear

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
