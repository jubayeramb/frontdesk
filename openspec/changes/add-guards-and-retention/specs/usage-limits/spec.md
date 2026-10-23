# Spec Delta

## Purpose

Caps how many agent turns one person, and everyone together, can use, so the demo stays up on a free model tier.

## ADDED Requirements

### Requirement: Per-contact limits
A contact SHALL get at most 20 agent turns in any rolling hour and 60 in a UTC day, across all channels.

#### Scenario: 21st message in an hour
- **WHEN** a contact sends a 21st message within an hour
- **THEN** the model is not called
- **AND** the contact receives "You've hit the demo limit.
  Try again in a bit."

### Requirement: Global daily cap
All contacts together SHALL get at most the configured number of agent turns per UTC day, set below the model provider's daily limit.

#### Scenario: Cap reached
- **WHEN** the global cap is reached and a new contact writes
- **THEN** the model is not called and they receive "The demo is resting for today.
  Try again tomorrow."

### Requirement: One limit reply per window
A contact over a limit SHALL receive the limit reply once, and further messages in the same window SHALL be stored without any reply.

#### Scenario: Spamming after the limit
- **WHEN** a contact over the hourly limit sends 10 more messages
- **THEN** they receive exactly one limit reply

### Requirement: Limits apply before the model
Limit checks SHALL run before any model call and SHALL not count turns that were refused.

#### Scenario: Refused turns are free
- **WHEN** 25 messages arrive quickly from one contact
- **THEN** the model is called 20 times, not 25
