# Spec Delta

## Purpose

Holds Triplone Tours' current tour prices and turns a customer's tour and group size into a quote that always matches the latest saved price list.

## ADDED Requirements

### Requirement: Quote from the current price list
The system SHALL compute a quote from a tour and a number of travelers, using the per-person price stored at the moment of the request.
The quote SHALL show the per-person price, the number of travelers, the total in BDT, and the price list version used.

#### Scenario: Group of four
- **WHEN** a quote is requested for the Sundarbans tour for 4 travelers and its stored price is ৳14,500 per person
- **THEN** the quote shows ৳14,500 × 4 and a total of ৳58,000
- **AND** the quote carries the current price list version

#### Scenario: Price changed since the last quote
- **WHEN** staff change the Sundarbans price and a new quote is requested with the same inputs
- **THEN** the new quote uses the new price and the new price list version
- **AND** the old total appears nowhere in it

### Requirement: Quote inputs are validated
The system SHALL reject a quote for an unknown or inactive tour, or for fewer than 1 or more than 10 travelers, and SHALL say which input is wrong.

#### Scenario: Too many travelers
- **WHEN** a quote is requested for 15 travelers
- **THEN** no quote is returned and the error says bookings take 1 to 10 travelers

### Requirement: Default price list is seeded
The system SHALL provide a seed command that loads the three default tours and their prices, and SHALL be safe to run more than once.

#### Scenario: Seeding twice
- **WHEN** the seed command runs on a database that already has tours, some edited by staff
- **THEN** no duplicate tours are created and staff edits are not overwritten

### Requirement: Staff edit prices
Staff SHALL be able to change any tour's per-person price and active flag from `/staff/pricing`.
Every save SHALL increase the price list version by one, atomically with the price change.

#### Scenario: Saving a new price
- **WHEN** staff change the Sylhet price from ৳8,500 to ৳9,000 and save
- **THEN** the stored price is ৳9,000 and the price list version is one higher than before

#### Scenario: Invalid amount
- **WHEN** staff enter a negative or non-numeric price and save
- **THEN** nothing is saved, the version does not change, and the form shows which field is invalid
