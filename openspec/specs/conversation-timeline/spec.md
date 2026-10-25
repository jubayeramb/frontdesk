# conversation-timeline Specification

## Purpose
Shows visitors their own conversation across web and WhatsApp in one place, including when a person has taken over.

## Requirements

### Requirement: Visitors see their own timeline only
`/c` SHALL show the conversation tied to the visitor's chat cookie, with messages from both channels in time order, and SHALL show nothing without a valid cookie.

#### Scenario: Linked conversation
- **WHEN** a visitor whose web conversation continued on WhatsApp opens `/c`
- **THEN** they see web and WhatsApp messages in order, each marked with its channel

#### Scenario: No cookie
- **WHEN** someone opens `/c` without a valid chat cookie
- **THEN** they see "No conversation yet" and a link to start one

### Requirement: Timeline shows who is answering
The timeline SHALL show whether the agent or a person owns the conversation, and SHALL show "A person will reply" while a person owns it.

#### Scenario: Handed to a person
- **WHEN** the owner is `human`
- **THEN** the timeline shows a "Person" badge and "A person will reply"

### Requirement: Timeline stays private
The timeline SHALL be read-only, SHALL mask phone numbers to the last 4 digits, and SHALL not show system details such as tool calls or internal ids.

#### Scenario: Phone number shown
- **WHEN** the conversation has a WhatsApp identity
- **THEN** the number appears as "•••• 4821"

### Requirement: Timeline updates while open
The timeline SHALL show new messages within 10 seconds without a manual reload.

#### Scenario: Staff reply arrives
- **WHEN** staff reply on WhatsApp while the visitor has `/c` open
- **THEN** the reply appears within 10 seconds
