## ADDED Requirements

### Requirement: Site header
Every public page SHALL show a header under the demo banner with the Triplone Tours name linking to `/`, a "Chat" link that opens the web chat panel on the home page, a "Conversation" link to `/c`, and a "Staff" link to `/staff`.

#### Scenario: Chat from the home page
- **WHEN** a visitor on `/` clicks "Chat" in the header
- **THEN** the chat panel opens

#### Scenario: Chat from the conversation page
- **WHEN** a visitor on `/c` clicks "Chat" in the header
- **THEN** they land on `/` with the chat panel open

#### Scenario: Closing the panel opened from the header
- **WHEN** the visitor closes a panel the header opened and reloads the page
- **THEN** the panel stays closed

#### Scenario: Conversation link
- **WHEN** a visitor clicks "Conversation"
- **THEN** they go to `/c`, which shows their conversation across web and WhatsApp

#### Scenario: Staff link
- **WHEN** a visitor clicks "Staff"
- **THEN** they go to `/staff`, which asks for the staff password unless they are signed in

### Requirement: Start on WhatsApp from the home page
The home page hero SHALL offer "Chat on the website", which opens the chat panel, and "Chat on WhatsApp", which opens WhatsApp in a new tab with the demo number and a greeting filled in that contains no link code.

#### Scenario: WhatsApp button
- **WHEN** a visitor looks at the "Chat on WhatsApp" button on `/`
- **THEN** it links to `https://wa.me/<demo number>` with a prefilled greeting and opens in a new tab

#### Scenario: Website button
- **WHEN** a visitor clicks "Chat on the website"
- **THEN** the chat panel opens
