# cross-channel-linking Specification

## Purpose
Moves a website conversation to WhatsApp without losing context, using a short one-time code instead of any personal detail.

## Requirements

### Requirement: Web visitors get a WhatsApp link with a code
When a web visitor asks to continue on WhatsApp, or asks for a person, the agent SHALL reply with a "Continue on WhatsApp" link that opens WhatsApp with "Hi! My code is TR-XXXXXX" prefilled.

#### Scenario: Visitor taps Continue on WhatsApp
- **WHEN** a web visitor with a quote asks to continue on WhatsApp
- **THEN** the reply has a link to the Triplone Tours number with a prefilled message containing a new code

### Requirement: Codes are short-lived and single use
A code SHALL be `TR-` followed by 6 characters from an alphabet without look-alike characters, SHALL expire 15 minutes after it is created, and SHALL work only once.

#### Scenario: Expired code
- **WHEN** a WhatsApp message contains a code created 20 minutes ago
- **THEN** no conversations are linked and the agent says the code expired and helps from scratch

#### Scenario: Reused code
- **WHEN** a second WhatsApp number sends a code that was already used
- **THEN** it is not linked to the web conversation

### Requirement: A valid code continues the web conversation on WhatsApp
A WhatsApp message containing a valid code SHALL attach that WhatsApp number to the web visitor's contact and make the web conversation the active conversation for that number, so the agent continues with the full history.

#### Scenario: Quote carries over
- **WHEN** a visitor got a quote on the web and sends their code on WhatsApp
- **THEN** the agent greets them on WhatsApp and refers to that quote without asking for the details again

#### Scenario: Returning WhatsApp customer
- **WHEN** a WhatsApp number that already has an older conversation sends a valid code
- **THEN** the older conversation is closed and kept, and the web conversation continues

### Requirement: Matching uses the code only
The system SHALL never link conversations by name, phone number, or any detail other than a valid code.

#### Scenario: Same name on both channels
- **WHEN** a web visitor and a WhatsApp customer give the same name but no code
- **THEN** their conversations stay separate
