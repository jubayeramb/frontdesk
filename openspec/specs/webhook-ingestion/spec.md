# webhook-ingestion Specification

## Purpose
Accepts Kapso's webhook deliveries safely: only genuine requests, each event handled exactly once, in order per customer, without making Kapso wait.

## Requirements

### Requirement: Only signed requests are accepted
The webhook endpoint SHALL verify the request signature against the raw body before parsing it, and SHALL reject a request with a missing or invalid signature with 401 and no side effects.

#### Scenario: Forged request
- **WHEN** a request arrives with a valid-looking body and a wrong signature
- **THEN** the response is 401 and nothing is stored or sent

#### Scenario: Genuine request
- **WHEN** a request arrives with a body signed by the webhook secret
- **THEN** it is accepted

### Requirement: Each event is processed once
The system SHALL store each event under a dedupe key and SHALL ignore a delivery whose key is already stored, so a retried or replayed event never produces a second reply.

#### Scenario: Kapso retries
- **WHEN** the same `message.received` event is delivered twice
- **THEN** the customer receives one reply

#### Scenario: Replayed fixture
- **WHEN** a captured fixture is posted twice with a valid signature
- **THEN** the second post returns 200 and changes nothing

### Requirement: Fast acknowledgement
The endpoint SHALL respond 200 once events are stored, without waiting for the model or for sends, so responses stay well under Kapso's 10 second limit.

#### Scenario: Slow model
- **WHEN** a turn takes 8 seconds
- **THEN** the webhook response was already sent before the turn started

### Requirement: In-order processing per customer
Events for the same WhatsApp contact SHALL be processed one at a time in arrival order, and two workers SHALL never process the same event.

#### Scenario: Two quick messages
- **WHEN** a customer sends "Sundarbans" and then "4 people" one second apart
- **THEN** the second turn starts only after the first finished, and sees the first in its history

### Requirement: Batched and single deliveries
The endpoint SHALL accept both a single event payload and a batched payload carrying several events, and SHALL treat each event in a batch like a single delivery.

#### Scenario: Buffered batch
- **WHEN** a batch of three `message.received` events arrives
- **THEN** three events are stored and processed in order

### Requirement: Stuck events are retried
An event left unprocessed for more than 2 minutes SHALL be picked up again, and an event that fails 3 times SHALL be marked failed with its error and not retried further.

#### Scenario: Worker died mid-turn
- **WHEN** an event is still pending 2 minutes after it was stored
- **THEN** the next webhook request or sweep processes it
