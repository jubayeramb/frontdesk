# Spec Delta

## ADDED Requirements

### Requirement: The customer sees the agent typing
When a new WhatsApp message that the agent will answer is stored, the customer's message SHALL be marked as read with WhatsApp's typing indicator, which shows until the reply is sent or for at most 25 seconds.
Showing it SHALL not delay the turn, and a failure to show it SHALL not stop the reply.

#### Scenario: Customer asks for a price
- **WHEN** a customer sends "how much is the Sundarbans tour for 2?"
- **THEN** Kapso receives a read receipt for that message with a text typing indicator before the reply is sent

#### Scenario: Typing indicator fails
- **WHEN** Kapso rejects the read receipt
- **THEN** the reply is still sent and the event is processed

#### Scenario: Message the agent skips
- **WHEN** a customer sends an image
- **THEN** no read receipt or typing indicator is sent

#### Scenario: Duplicate delivery
- **WHEN** Kapso delivers the same message twice
- **THEN** one read receipt is sent

## MODIFIED Requirements

### Requirement: Choices degrade to what WhatsApp supports
A `choices` reply SHALL render as reply buttons when it has 3 options or fewer and every label fits a button title (20 characters), as a list message when it has up to 10 options otherwise, and as numbered text ("Reply 1-12") when it has more than 10.
A list SHALL open from a button that names the set, such as "View tours" or "View dates".

#### Scenario: Three options
- **WHEN** the agent returns a `choices` reply with 3 options whose labels fit a button title
- **THEN** one interactive button message with 3 buttons is sent

#### Scenario: Three options with a long label
- **WHEN** the agent returns the three tours and one is "Sundarbans 3-day boat tour"
- **THEN** one interactive list message with 3 rows is sent, opened by a "View tours" button, and that row shows the full label

#### Scenario: Ten options
- **WHEN** the agent returns a `choices` reply with 10 options
- **THEN** one interactive list message with 10 rows is sent

#### Scenario: Twelve options
- **WHEN** the agent returns a `choices` reply with 12 options
- **THEN** one text message is sent with the prompt and options numbered 1 to 12, ending with "Reply 1-12"
