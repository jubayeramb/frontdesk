## MODIFIED Requirements

### Requirement: In-order processing per customer
Events for the same WhatsApp contact SHALL be processed one at a time in arrival order, and two workers SHALL never process the same event.
A contact SHALL be identified by its business-scoped user id when the event carries one, and by its phone number otherwise, and an event that carries neither SHALL be rejected.

#### Scenario: Two quick messages
- **WHEN** a customer sends "Sundarbans" and then "4 people" one second apart
- **THEN** the second turn starts only after the first finished, and sees the first in its history

#### Scenario: Customer known only by user id
- **WHEN** a `message.received` event has no phone number and carries `conversation.business_scoped_user_id`
- **THEN** the event is stored and the customer gets a reply

#### Scenario: Phone number disappears
- **WHEN** a customer's earlier events carried a phone number and a user id, and the next carries only the user id
- **THEN** the next message continues the same conversation
