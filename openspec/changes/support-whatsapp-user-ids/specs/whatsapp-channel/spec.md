## ADDED Requirements

### Requirement: Customers known only by user id
Replies, inbox takeovers, conversation-ended hand-backs and link codes SHALL work the same for a customer Kapso identifies only by a business-scoped user id as for one identified by phone number.
A reply SHALL be addressed to the phone number when there is one, and to the user id otherwise.

#### Scenario: Reply by user id
- **WHEN** a customer with no phone number in the payload sends "Hi"
- **THEN** the agent's reply is sent to their user id

#### Scenario: Inbox reply to a user-id customer
- **WHEN** staff reply from the inbox to a customer known only by user id
- **THEN** the conversation is owned by a person and the agent stays quiet

#### Scenario: Link code from a user-id customer
- **WHEN** a customer known only by user id sends a valid link code
- **THEN** WhatsApp continues the web conversation
