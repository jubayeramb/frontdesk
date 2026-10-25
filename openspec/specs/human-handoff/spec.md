# human-handoff Specification

## Purpose
Decides who answers a conversation, the agent or a person, and makes sure the agent stays quiet whenever a person has taken over.

## Requirements

### Requirement: The agent is silent while a human owns the conversation
When a conversation is owned by `human`, inbound customer messages SHALL be stored and SHALL not trigger an agent turn or any automated reply.

#### Scenario: Customer writes during a human conversation
- **WHEN** a human owns the conversation and the customer sends "thanks, also can you do Friday?"
- **THEN** the message is stored and no agent reply is sent

### Requirement: Customer asks for a person on WhatsApp
When a WhatsApp customer asks for a person, the system SHALL set the owner to `human`, send one handoff message saying a person will reply, and stop replying automatically.

#### Scenario: "Can I talk to a person"
- **WHEN** a WhatsApp customer owned by `ai` writes "can I talk to a person"
- **THEN** the customer receives "A person will reply here soon."
- **AND** the owner is `human`

### Requirement: Booking changes and cancellations go to a person
The agent SHALL not change or cancel bookings.
When a customer asks to change a booking's date or travelers, or to cancel it, the agent SHALL hand off as if they asked for a person (on WhatsApp the owner becomes `human`; on the web the visitor gets the WhatsApp link), and SHALL not offer a new booking in place of the change.

#### Scenario: Customer asks to cancel on WhatsApp
- **WHEN** a WhatsApp customer with a booking writes "please cancel my booking"
- **THEN** the customer is told a person will handle the cancellation
- **AND** the owner is `human`

#### Scenario: Customer asks to move a booking
- **WHEN** a customer with a booking writes "can we move our booking to the next date?"
- **THEN** no departures are offered and no booking is made
- **AND** the conversation is handed to a person

### Requirement: Web visitors are sent to WhatsApp for a person
A web conversation SHALL never be answered by a person.
When a web visitor asks for a person, the agent SHALL reply with a link that opens a WhatsApp chat with Triplone Tours, and the web conversation SHALL stay owned by `ai`.

#### Scenario: Web visitor asks for a person
- **WHEN** a web visitor writes "I want to talk to someone"
- **THEN** the reply says a person replies on WhatsApp and includes a "Continue on WhatsApp" link
- **AND** the web conversation owner is still `ai`

### Requirement: A reply from the inbox takes over the conversation
An outbound WhatsApp message that the system did not send SHALL be stored as sent by `human`, and SHALL set the owner to `human` if it was `ai`.

#### Scenario: Staff reply without a handoff request
- **WHEN** staff reply from the inbox to a conversation owned by `ai`
- **THEN** the reply is stored with sender `human` and the owner becomes `human`
- **AND** the agent does not answer the customer's next message

#### Scenario: Our own send echoes back
- **WHEN** the `message.sent` event for an agent reply arrives before the send result was stored
- **THEN** it is recognized as the agent's message and ownership does not change

### Requirement: Handing back to the agent
The owner SHALL return to `ai` when staff press "Hand back to AI" or when Kapso reports the WhatsApp conversation ended, and the next customer message SHALL get an agent reply.

#### Scenario: Staff hand back
- **WHEN** staff press "Hand back to AI" on a human-owned conversation and the customer then writes "what time is my booking?"
- **THEN** the agent answers

#### Scenario: Conversation ended in Kapso
- **WHEN** a `whatsapp.conversation.ended` event arrives for a human-owned conversation
- **THEN** the owner becomes `ai`

### Requirement: Ownership changes are recorded
Every ownership change SHALL store when it happened and why (customer request, human reply, hand back, conversation ended) as a system message in the conversation.

#### Scenario: Audit trail
- **WHEN** a conversation goes from `ai` to `human` and back
- **THEN** two system messages record each change with its reason and time

### Requirement: Read receipts whoever owns the conversation
Every customer message on WhatsApp SHALL be marked read when it arrives, and the typing indicator SHALL show only while the agent owns the conversation.

#### Scenario: Message while a person owns the conversation
- **WHEN** a customer writes while the owner is `human`
- **THEN** the message is marked read and no typing indicator is shown
