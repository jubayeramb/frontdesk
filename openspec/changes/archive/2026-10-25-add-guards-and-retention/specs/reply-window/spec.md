# Spec Delta

## Purpose

Keeps WhatsApp sends inside Meta's 24-hour customer service window and makes the window visible to visitors and staff.

## ADDED Requirements

### Requirement: No free-form sends outside the window
The system SHALL not send a free-form WhatsApp message to a customer whose last inbound message is 24 hours old or more, and SHALL store the blocked message with the reason instead.

#### Scenario: Late retry
- **WHEN** a reply is ready 24 hours and 5 minutes after the customer's last message
- **THEN** it is not sent and is stored as blocked by the reply window

#### Scenario: Inside the window
- **WHEN** a reply is ready 23 hours after the customer's last message
- **THEN** it is sent

### Requirement: The window is visible
`/c` and the `/staff` conversation list SHALL show the time left in the WhatsApp reply window for conversations with a WhatsApp identity, and SHALL show "Window closed" once it has passed.

#### Scenario: Countdown on the timeline
- **WHEN** the customer last wrote 21 hours ago
- **THEN** `/c` shows about 3 hours left

#### Scenario: Closed window
- **WHEN** the customer last wrote 30 hours ago
- **THEN** `/c` and `/staff` show "Window closed"
