# conversation-history Specification

## Purpose
Keeps one record per customer conversation across channels, so the agent and staff see the same history wherever the customer writes from.

## Requirements

### Requirement: One contact, many channel identities
The system SHALL store a contact with zero or more channel identities, and an identity (channel plus external id) SHALL belong to exactly one contact.

#### Scenario: Same WhatsApp number writes twice
- **WHEN** a WhatsApp number that already has an identity sends a message
- **THEN** the message joins that contact's open conversation and no new contact is created

### Requirement: Every message is stored with its channel and sender
The system SHALL store every inbound and outbound message with its conversation, channel, direction, sender (`customer`, `ai`, `human` or `system`), text body and structured payload.

#### Scenario: Agent reply with choices
- **WHEN** the agent replies with a `choices` reply on WhatsApp
- **THEN** the stored message has channel `whatsapp`, direction `outbound`, sender `ai`, the prompt as body and the options in its payload

### Requirement: Bounded history for the model
The agent SHALL see at most the last 20 messages of a conversation plus a state summary holding the latest quote and booking, so older context is never lost even when it falls out of the window.

#### Scenario: Long conversation
- **WHEN** a conversation has 45 messages and a quote from message 3
- **THEN** the model receives the last 20 messages and a summary containing that quote

### Requirement: Conversation state is updated by tools
The latest quote and booking SHALL be written to the conversation state by the tools that produce them, not by parsing model text.

#### Scenario: New quote replaces the old one
- **WHEN** a second quote is computed in the same conversation
- **THEN** the state holds only the second quote, with its price list version
