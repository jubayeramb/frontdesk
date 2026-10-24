# Spec Delta

## ADDED Requirements

### Requirement: The customer sees the agent typing
When the agent starts answering a WhatsApp message, the customer's message SHALL be marked as read with WhatsApp's typing indicator, which shows until the reply is sent or for at most 25 seconds.
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
