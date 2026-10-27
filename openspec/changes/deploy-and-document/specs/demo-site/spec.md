# Spec Delta

## MODIFIED Requirements

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
