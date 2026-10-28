# whatsapp-channel Specification

## Purpose
Delivers the agent's replies on WhatsApp in the richest form WhatsApp allows, and reads customers' taps and numbered answers back as choices.

## Requirements

### Requirement: Choices degrade to what WhatsApp supports
A `choices` reply SHALL render as reply buttons when it has 3 options or fewer and every label fits a button title (20 characters), as a list message when it has up to 10 options otherwise, and as numbered text ("Reply 1-12") when it has more than 10.
A list SHALL open from a button that names the set, such as "View tours" or "View dates".

#### Scenario: Three options
- **WHEN** the agent returns a `choices` reply with 3 options whose labels fit a button title
- **THEN** one interactive button message with 3 buttons is sent

#### Scenario: Three options with a long label
- **WHEN** the agent returns the three tours and one is "Sundarbans 3-day boat tour"
- **THEN** one interactive list message with 3 rows is sent, opened by a "View tours" button, and that row shows the full label

#### Scenario: Ten options
- **WHEN** the agent returns a `choices` reply with 10 options
- **THEN** one interactive list message with 10 rows is sent

#### Scenario: Twelve options
- **WHEN** the agent returns a `choices` reply with 12 options
- **THEN** one text message is sent with the prompt and options numbered 1 to 12, ending with "Reply 1-12"

### Requirement: Content fits WhatsApp limits
Rendered messages SHALL respect WhatsApp's limits (button titles 20 characters, list row titles 24, body 1024 for interactive and 4096 for text) by shortening labels with an ellipsis and splitting long text, never by failing the send.

#### Scenario: Long departure label
- **WHEN** an option label is "Sundarbans 3-day, Thursday 6 November" for a list row
- **THEN** the row title is at most 24 characters and still shows the tour and the date

### Requirement: No markdown on WhatsApp
Text sent on WhatsApp SHALL not contain markdown syntax such as `**`, `#` headings or `[label](url)` links; links SHALL appear as plain URLs.

#### Scenario: Model returns bold text
- **WHEN** a reply text is "Your total is **৳58,000**"
- **THEN** WhatsApp receives "Your total is ৳58,000"

### Requirement: Taps and numbers map back to options
A button reply, a list reply, or a plain number matching the last numbered choices SHALL reach the agent as the chosen option's id.

#### Scenario: Customer taps a list row
- **WHEN** the customer taps the row for Thursday 9:00
- **THEN** the agent receives the id of that departure as the inbound choice

#### Scenario: Customer replies with a number
- **WHEN** the last reply was numbered choices 1 to 12 and the customer sends "7"
- **THEN** the agent receives the id of option 7

### Requirement: Outbound messages are recorded before sending
Every outbound WhatsApp message SHALL be stored before the send is attempted and SHALL be updated with its WhatsApp message id after a successful send, or marked failed after an error.

#### Scenario: Send fails
- **WHEN** Kapso rejects a send
- **THEN** the stored message is marked failed with the error code, and no WhatsApp id is set

#### Scenario: Delivery failure reported later
- **WHEN** a `whatsapp.message.failed` event arrives for a message we sent
- **THEN** that message is marked failed with the reported error

### Requirement: The customer sees the agent typing
When a new WhatsApp message that the agent will answer is stored, the customer's message SHALL be marked as read with WhatsApp's typing indicator, which shows until the reply is sent or for at most 25 seconds.
Showing it SHALL not delay the turn, and a failure to show it SHALL not stop the reply.

#### Scenario: Customer asks for a price
- **WHEN** a customer sends "how much is the Sundarbans tour for 2?"
- **THEN** Kapso receives a read receipt for that message with a text typing indicator before the reply is sent

#### Scenario: Typing indicator fails
- **WHEN** Kapso rejects the read receipt
- **THEN** the reply is still sent and the event is processed

#### Scenario: Message the agent skips
- **WHEN** a customer sends an image
- **THEN** no read receipt or typing indicator is sent

#### Scenario: Duplicate delivery
- **WHEN** Kapso delivers the same message twice
- **THEN** one read receipt is sent

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
