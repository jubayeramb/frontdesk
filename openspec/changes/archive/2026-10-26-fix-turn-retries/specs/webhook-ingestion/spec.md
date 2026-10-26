# Spec Delta

## Purpose

Makes sure a failed or interrupted event still ends in an answer, without waiting for unrelated traffic.

## MODIFIED Requirements

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

## ADDED Requirements

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
