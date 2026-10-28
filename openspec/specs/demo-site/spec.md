# demo-site Specification

## Purpose
Presents Triplone Tours as a believable small tour agency while making it impossible to mistake the demo for a real one.

## Requirements

### Requirement: Demo banner on every page
Every public page SHALL show "Demo business.
No real bookings." at the top, visible without scrolling.

#### Scenario: Landing page
- **WHEN** a visitor opens `/`
- **THEN** the banner is the first thing on the page

### Requirement: Landing page explains the business
The landing page SHALL describe the three tours, that the agency is based in Dhaka, and how to get a quote and book through the chat, without listing prices that could drift from the database.

#### Scenario: Visitor looks for prices
- **WHEN** a visitor reads the landing page
- **THEN** it invites them to ask the chat for a quote instead of showing a price table

### Requirement: Privacy note
Every public page with the chat SHALL say that conversations are stored for 7 days and then deleted, and that the demo should not be sent personal details.

#### Scenario: Footer note
- **WHEN** a visitor scrolls to the footer of `/`
- **THEN** they see the retention and privacy note

### Requirement: Light and dark themes
Public pages SHALL follow the visitor's system color scheme and stay readable in both.

#### Scenario: Dark system theme
- **WHEN** the visitor's system is in dark mode
- **THEN** the site and the chat panel render in dark colors with sufficient contrast

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
Next to the WhatsApp button, the hero SHALL say that WhatsApp runs on Kapso's sandbox number, which only answers registered phones, and give an email link for asking to be added.

#### Scenario: WhatsApp button
- **WHEN** a visitor looks at the "Chat on WhatsApp" button on `/`
- **THEN** it links to `https://wa.me/<demo number>` with a prefilled greeting and opens in a new tab

#### Scenario: Website button
- **WHEN** a visitor clicks "Chat on the website"
- **THEN** the chat panel opens

#### Scenario: Access note
- **WHEN** a visitor reads the hero
- **THEN** a note under the buttons says WhatsApp only answers registered phones and links to an email address for access
