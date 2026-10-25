## ADDED Requirements

### Requirement: Replies stay on their channel
A reply SHALL go out only on the channel of the message it answers, even when the conversation continues on both channels.

#### Scenario: Web message in a linked conversation
- **WHEN** a visitor whose conversation continues on WhatsApp sends a message from the web panel
- **THEN** the reply appears in the panel and nothing is sent to WhatsApp

### Requirement: The panel shows both channels and stays current
The chat panel SHALL show the conversation's messages from both channels, mark messages from WhatsApp, show staff replies as the Triplone Tours team, show linking and ownership notes, and refresh every 5 seconds while open and visible.

#### Scenario: WhatsApp message arrives while the panel is open
- **WHEN** the visitor has the panel open and a message is added on WhatsApp
- **THEN** it appears in the panel, marked "WhatsApp", without a reload

#### Scenario: Staff reply
- **WHEN** staff replied from the inbox
- **THEN** the panel shows that message from "Triplone Tours team", not from the agent

#### Scenario: Continued on WhatsApp
- **WHEN** the conversation continues on WhatsApp
- **THEN** the panel says "This chat continues on WhatsApp" with the masked number and a link to open WhatsApp

### Requirement: Web messages while a person owns the conversation
While a person owns the conversation, the panel SHALL say a person is answering on WhatsApp, and a message sent from the panel SHALL be stored and answered with a fixed notice linking to WhatsApp, without running the agent.

#### Scenario: Message to a person from the web
- **WHEN** a person owns the conversation and the visitor sends a message from the panel
- **THEN** the message is stored, the agent does not run, and the visitor sees "A person from our team is answering on WhatsApp. Reply there to reach them." with an "Open WhatsApp" link

#### Scenario: Resubmitted message to a person
- **WHEN** the same message is submitted again with the same nonce while a person owns the conversation
- **THEN** the same notice comes back at once and the message is stored once
