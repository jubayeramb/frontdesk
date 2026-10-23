# Spec Delta

## Purpose

Answers each customer message for Mopwell Cleaning with replies grounded in live data, the same way on every channel.

## ADDED Requirements

### Requirement: Prices come only from the quote tool
The agent SHALL state a price only when that price was returned by the quote tool during the current turn or stored as the conversation's latest quote, and SHALL never state a price from memory.

#### Scenario: Customer asks for a price
- **WHEN** a customer with no quote yet asks "how much for a 3 bed 2 bath standard clean?"
- **THEN** the agent calls the quote tool with those inputs
- **AND** the reply contains the tool's total and no other amount

#### Scenario: Missing details
- **WHEN** a customer asks "how much is a cleaning?" without home details
- **THEN** the agent asks for the service, bedrooms and bathrooms instead of guessing a price

#### Scenario: Price changed between turns
- **WHEN** staff change a price after a quote and the customer asks for the quote again
- **THEN** the agent calls the quote tool again and the reply shows the new total and the new price list version

### Requirement: Choices come only from tool results
When the agent offers a set of options (services, add-ons or slots), the system SHALL build that `choices` reply from the tool result, with one option per returned item and ids that the tool accepts back.

#### Scenario: Offering slots
- **WHEN** the agent calls the slot tool and 6 slots are free
- **THEN** the turn returns a `choices` reply with exactly those 6 slots as options

#### Scenario: Customer picks an option
- **WHEN** the next inbound message is the id of one of those options
- **THEN** the agent treats it as that choice without asking again

### Requirement: Booking confirms only what was stored
The agent SHALL confirm a booking only after the booking tool reports success, and SHALL offer other slots when the tool reports the slot was taken.

#### Scenario: Slot taken
- **WHEN** the booking tool returns "taken"
- **THEN** the agent says that slot just went and offers the current free slots

### Requirement: Scoped to Mopwell
The agent SHALL only help with Mopwell's cleaning services, quotes, bookings and contacting a person, and SHALL politely refuse anything else in one or two sentences.

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

#### Scenario: Invalid bedroom count
- **WHEN** the quote tool rejects 9 bedrooms
- **THEN** the agent says it can quote 1 to 5 bedrooms and asks again
