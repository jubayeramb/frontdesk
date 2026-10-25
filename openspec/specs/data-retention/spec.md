# data-retention Specification

## Purpose
Deletes visitors' conversation data after 7 days, so the demo never accumulates personal data.

## Requirements

### Requirement: Seven-day retention
Conversations with no activity for 7 days SHALL be deleted along with their messages, bookings and link codes, and contacts and identities left without conversations SHALL be deleted too.

#### Scenario: Old conversation
- **WHEN** the retention job runs and a conversation's last message is 8 days old
- **THEN** the conversation, its messages, its bookings and its link codes are gone

#### Scenario: Active conversation
- **WHEN** a conversation started 10 days ago but had a message yesterday
- **THEN** it is kept

### Requirement: Processed webhook events are pruned
Webhook events that finished or failed more than 7 days ago SHALL be deleted.

#### Scenario: Old events
- **WHEN** the retention job runs
- **THEN** no `done` or `failed` event older than 7 days remains

### Requirement: Only the scheduler can run retention
The retention endpoint SHALL refuse any request without the cron secret.

#### Scenario: Stranger calls the endpoint
- **WHEN** a request without the cron secret hits the retention endpoint
- **THEN** it gets 401 and nothing is deleted
