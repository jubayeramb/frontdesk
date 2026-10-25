# inbound-filtering Specification

## Purpose
Decides which inbound WhatsApp messages the agent reads, so reactions and media never waste a turn or confuse the agent.

## Requirements

### Requirement: Silent events get no reply
Reactions, delivery and read statuses, and echoes of our own messages SHALL never trigger an agent turn or a reply.

#### Scenario: Customer reacts with a thumbs up
- **WHEN** a customer reacts to the agent's message with 👍
- **THEN** nothing is sent and no turn runs

### Requirement: Unsupported messages get a fixed reply
Images, audio, video, documents, stickers, locations and contact cards SHALL be stored and answered with "I can only read text for now." without calling the model.

#### Scenario: Customer sends a photo of the kitchen
- **WHEN** a customer sends an image
- **THEN** they receive "I can only read text for now." and the model is not called

### Requirement: Long messages are cut
Inbound text longer than 1,000 characters SHALL be cut to 1,000 characters before it reaches the model, and the full text SHALL still be stored.

#### Scenario: Pasted essay
- **WHEN** a customer sends 5,000 characters
- **THEN** the model sees the first 1,000 and the stored message keeps all 5,000
