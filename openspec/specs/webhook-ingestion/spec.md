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
A contact SHALL be identified by its business-scoped user id when the event carries one, and by its phone number otherwise, and an event that carries neither SHALL be rejected.

#### Scenario: Two quick messages
- **WHEN** a customer sends "Sundarbans" and then "4 people" one second apart
- **THEN** the second turn starts only after the first finished, and sees the first in its history

#### Scenario: Customer known only by user id
- **WHEN** a `message.received` event has no phone number and carries `conversation.business_scoped_user_id`
- **THEN** the event is stored and the customer gets a reply

#### Scenario: Phone number disappears
- **WHEN** a customer's earlier events carried a phone number and a user id, and the next carries only the user id
- **THEN** the next message continues the same conversation

### Requirement: Batched and single deliveries
The endpoint SHALL accept both a single event payload and a batched payload carrying several events, and SHALL treat each event in a batch like a single delivery.

#### Scenario: Buffered batch
- **WHEN** a batch of three `message.received` events arrives
- **THEN** three events are stored and processed in order

### Requirement: Stuck events are retried
An event left unprocessed for more than 2 minutes SHALL be picked up again, and an event that fails 3 times SHALL be marked failed with its error and not retried further.
A failed event SHALL be retried by the worker that ran it after a wait of 5 seconds times its attempts so far, and the customer's later events SHALL run once it succeeds or is marked failed.

#### Scenario: Worker died mid-turn
- **WHEN** an event is still pending 2 minutes after it was stored
- **THEN** the next webhook request or sweep processes it

#### Scenario: The model fails once
- **WHEN** a turn throws on its first attempt and no other request arrives
- **THEN** the same worker runs it again about 5 seconds later and the customer gets a reply

#### Scenario: An event fails for good
- **WHEN** an event fails 3 times
- **THEN** it is marked failed and the customer's next queued message is answered

### Requirement: A retry finishes an interrupted turn
A retried `message.received` whose message is already stored SHALL run the turn for it when no reply follows it, and SHALL send stored replies that were never attempted, so the message is answered once.

#### Scenario: Turn failed after the message was stored
- **WHEN** a turn throws after storing the customer's message, and the event is retried
- **THEN** the turn runs for that message without storing it again, and the customer gets one reply

#### Scenario: Replies stored but not sent
- **WHEN** the worker stopped after storing a turn's replies and before sending them
- **THEN** the retry sends those replies and runs no new turn

#### Scenario: Already answered
- **WHEN** a delivered event is retried after its replies were sent
- **THEN** nothing is sent
