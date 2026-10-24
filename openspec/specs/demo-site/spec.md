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
