# web-chat Specification

## Purpose
Lets a website visitor talk to the front desk in a chat panel, with the same agent and the same grounded answers as WhatsApp.

## Requirements

### Requirement: Visitors chat from any page
The site SHALL show a chat bubble that opens a chat panel where the visitor can send messages and read the agent's replies.

#### Scenario: First message
- **WHEN** a new visitor opens the chat and sends "how much is the Sylhet tour?"
- **THEN** their message appears, a typing indicator shows, and the agent's reply appears below it

### Requirement: Every reply kind renders natively
The widget SHALL render `text` replies as message bubbles with basic formatting, `choices` replies as tappable chips, and `link` replies as a button that opens the URL.

#### Scenario: Departure chips
- **WHEN** the agent returns a `choices` reply with 4 departures
- **THEN** 4 chips are shown under the prompt
- **AND** tapping one sends that option as the visitor's next message and disables the other chips

### Requirement: The conversation survives reloads
The visitor's conversation SHALL be tied to a signed, `httpOnly` cookie, and reopening the widget SHALL restore the transcript.
A tampered or unknown cookie SHALL start a new conversation, not expose another one.

#### Scenario: Reload mid-quote
- **WHEN** a visitor gets a quote and reloads the page
- **THEN** the transcript, including the quote, is shown again and the agent still knows the quote

#### Scenario: Forged cookie
- **WHEN** a request carries a conversation cookie with an invalid signature
- **THEN** a new conversation starts and no other visitor's messages are returned

### Requirement: A resubmitted message runs once
Each message SHALL carry a client nonce, and a second request with the same nonce SHALL return the first request's replies without running another turn.

#### Scenario: Double click on send
- **WHEN** the same message is submitted twice within a second
- **THEN** the agent runs once and the visitor sees one reply

### Requirement: Errors are honest and recoverable
When a turn fails, the widget SHALL say what happened and offer a retry, and SHALL keep the visitor's message in the transcript.

#### Scenario: Network failure
- **WHEN** the chat request fails
- **THEN** the widget shows "Couldn't send.
  Try again." with a retry button next to the message

### Requirement: Accessible chat
The widget SHALL be usable with a keyboard alone, SHALL announce new replies to screen readers, and SHALL fit a 360px wide screen without horizontal scrolling.

#### Scenario: Keyboard only
- **WHEN** a visitor tabs to the bubble, presses Enter, types and presses Enter
- **THEN** the panel opens, focus is in the input, and the message is sent

#### Scenario: Phone width
- **WHEN** the page is 360px wide and the panel is open
- **THEN** the panel fills the screen and nothing scrolls sideways

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
