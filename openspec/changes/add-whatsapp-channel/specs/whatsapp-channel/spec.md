# Spec Delta

## Purpose

Delivers the agent's replies on WhatsApp in the richest form WhatsApp allows, and reads customers' taps and numbered answers back as choices.

## ADDED Requirements

### Requirement: Choices degrade to what WhatsApp supports
A `choices` reply SHALL render as reply buttons when it has 3 options or fewer, as a list message when it has 4 to 10, and as numbered text ("Reply 1-12") when it has more than 10.

#### Scenario: Three options
- **WHEN** the agent returns a `choices` reply with 3 options
- **THEN** one interactive button message with 3 buttons is sent

#### Scenario: Ten options
- **WHEN** the agent returns a `choices` reply with 10 options
- **THEN** one interactive list message with 10 rows is sent

#### Scenario: Twelve options
- **WHEN** the agent returns a `choices` reply with 12 options
- **THEN** one text message is sent with the prompt and options numbered 1 to 12, ending with "Reply 1-12"

### Requirement: Content fits WhatsApp limits
Rendered messages SHALL respect WhatsApp's limits (button titles 20 characters, list row titles 24, body 1024 for interactive and 4096 for text) by shortening labels with an ellipsis and splitting long text, never by failing the send.

#### Scenario: Long departure label
- **WHEN** an option label is "Sundarbans 3-day, Thursday 6 November" for a list row
- **THEN** the row title is at most 24 characters and still shows the tour and the date

### Requirement: No markdown on WhatsApp
Text sent on WhatsApp SHALL not contain markdown syntax such as `**`, `#` headings or `[label](url)` links; links SHALL appear as plain URLs.

#### Scenario: Model returns bold text
- **WHEN** a reply text is "Your total is **৳58,000**"
- **THEN** WhatsApp receives "Your total is ৳58,000"

### Requirement: Taps and numbers map back to options
A button reply, a list reply, or a plain number matching the last numbered choices SHALL reach the agent as the chosen option's id.

#### Scenario: Customer taps a list row
- **WHEN** the customer taps the row for Thursday 9:00
- **THEN** the agent receives the id of that departure as the inbound choice

#### Scenario: Customer replies with a number
- **WHEN** the last reply was numbered choices 1 to 12 and the customer sends "7"
- **THEN** the agent receives the id of option 7

### Requirement: Outbound messages are recorded before sending
Every outbound WhatsApp message SHALL be stored before the send is attempted and SHALL be updated with its WhatsApp message id after a successful send, or marked failed after an error.

#### Scenario: Send fails
- **WHEN** Kapso rejects a send
- **THEN** the stored message is marked failed with the error code, and no WhatsApp id is set

#### Scenario: Delivery failure reported later
- **WHEN** a `whatsapp.message.failed` event arrives for a message we sent
- **THEN** that message is marked failed with the reported error
