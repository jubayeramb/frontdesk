# Spec Delta

## Purpose

Gives staff one private page to read and answer WhatsApp conversations and to give them back to the agent.

## ADDED Requirements

### Requirement: Embedded inbox for staff only
`/staff` SHALL show Kapso's inbox for the demo WhatsApp number to signed-in staff, and the inbox address SHALL never be sent to a browser without a staff session.

#### Scenario: Signed-in staff
- **WHEN** signed-in staff open `/staff`
- **THEN** the embedded inbox loads and shows the demo number's conversations

#### Scenario: Visitor tries to find the inbox
- **WHEN** a visitor without a staff session requests `/staff` or any public page
- **THEN** no response contains the inbox address or its token

### Requirement: Conversation list with ownership
`/staff` SHALL list recent conversations with channel, owner, last message time and a short preview, newest first.

#### Scenario: Human-owned conversation
- **WHEN** a WhatsApp conversation is owned by `human`
- **THEN** its row shows a "Human" badge and a "Hand back to AI" button

### Requirement: Hand back from the list
Pressing "Hand back to AI" SHALL return that conversation to the agent and update the row without a full page reload.

#### Scenario: Hand back
- **WHEN** staff press "Hand back to AI"
- **THEN** the row shows an "AI" badge and the button disappears
