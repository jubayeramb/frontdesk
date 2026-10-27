## MODIFIED Requirements

### Requirement: Timeline stays private
The timeline SHALL be read-only, SHALL mask phone numbers to the last 4 digits, and SHALL not show system details such as tool calls or internal ids.
A WhatsApp identity that is not a phone number SHALL never be shown, in part or in full.

#### Scenario: Phone number shown
- **WHEN** the conversation has a WhatsApp identity
- **THEN** the number appears as "•••• 4821"

#### Scenario: Known only by user id
- **WHEN** the contact's only WhatsApp identity is a business-scoped user id
- **THEN** the timeline shows "WhatsApp" with no digits
