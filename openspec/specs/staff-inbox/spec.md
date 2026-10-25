# staff-inbox Specification

## Purpose
Gives staff one private page to read and answer WhatsApp conversations and to give them back to the agent.

## Requirements

### Requirement: Embedded inbox for staff only
`/staff` SHALL show Kapso's inbox for the demo WhatsApp number to signed-in staff, and the inbox address SHALL never be sent to a browser without a staff session.

#### Scenario: Signed-in staff
- **WHEN** signed-in staff open `/staff`
- **THEN** the embedded inbox loads and shows the demo number's conversations

#### Scenario: Visitor tries to find the inbox
- **WHEN** a visitor without a staff session requests `/staff` or any public page
- **THEN** no response contains the inbox address or its token

### Requirement: Handed-over list
Next to the inbox, `/staff` SHALL list only the conversations a person owns, each with why it was handed over, when, and a "Hand back to AI" button, longest waiting first.
Kapso's inbox already lists every conversation, so this list SHALL NOT repeat the ones the agent is answering.
The list SHALL pick up ownership changes within 5 seconds without a page reload, and the inbox frame SHALL NOT reload when it does.

#### Scenario: Human-owned conversation
- **WHEN** a WhatsApp conversation is owned by `human`
- **THEN** it is listed with the reason, for example "the customer asked to cancel a booking", and a "Hand back to AI" button

#### Scenario: Nobody waiting
- **WHEN** the agent owns every conversation
- **THEN** the list says the agent is answering everyone

#### Scenario: Takeover while the page is open
- **WHEN** a customer asks for a person while staff have `/staff` open
- **THEN** the conversation appears in the list within 5 seconds, and the inbox frame keeps its state

### Requirement: Hand back from the list
Pressing "Hand back to AI" SHALL return that conversation to the agent and update the row without a full page reload.

#### Scenario: Hand back
- **WHEN** staff press "Hand back to AI"
- **THEN** the conversation leaves the list
