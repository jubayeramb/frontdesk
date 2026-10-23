# Spec Delta

## Purpose

Holds Mopwell's current prices and turns a customer's home details into an itemized quote that always matches the latest saved price list.

## ADDED Requirements

### Requirement: Itemized quote from the current price list
The system SHALL compute a quote from a service, a bedroom count, a bathroom count and optional add-ons, using the price list stored at the moment of the request.
The quote SHALL list each line item with its amount, the total, and the price list version used.

#### Scenario: Standard clean with an extra bathroom and an add-on
- **WHEN** a quote is requested for a standard clean, 3 bedrooms, 2 bathrooms and the oven add-on
- **THEN** the quote lists the 3-bedroom base price, one extra bathroom, and the oven add-on, each with its stored amount
- **AND** the total equals the sum of the line items
- **AND** the quote carries the current price list version

#### Scenario: Price changed since the last quote
- **WHEN** staff change the 3-bedroom standard base price and a new quote is requested with the same inputs
- **THEN** the new quote uses the new amount and the new price list version
- **AND** the old amount appears nowhere in it

### Requirement: Quote inputs are validated
The system SHALL reject a quote request for an unknown or inactive service, an unknown or inactive add-on, or a bedroom or bathroom count outside the supported range, and SHALL say which input is wrong.

#### Scenario: Bedroom count out of range
- **WHEN** a quote is requested for 9 bedrooms and the price list covers 1 to 5
- **THEN** no quote is returned
- **AND** the error names the bedroom count and the supported range

#### Scenario: Inactive add-on
- **WHEN** a quote is requested with an add-on that staff have deactivated
- **THEN** no quote is returned
- **AND** the error names that add-on

### Requirement: Amounts are exact
The system SHALL store and compute all amounts as whole cents and SHALL never round during calculation.

#### Scenario: Totals add up exactly
- **WHEN** a quote has line items of 12999, 2500 and 3500 cents
- **THEN** the total is exactly 18999 cents

### Requirement: Default price list is seeded
The system SHALL provide a seed command that loads Mopwell's default services, price rules and add-ons, and SHALL be safe to run more than once.

#### Scenario: Seeding an empty database
- **WHEN** the seed command runs against an empty, migrated database
- **THEN** standard clean and deep clean exist with base prices for 1 to 5 bedrooms, an extra-bathroom price, and the oven, fridge and inside-windows add-ons

#### Scenario: Seeding twice
- **WHEN** the seed command runs a second time
- **THEN** no duplicate rows are created and staff edits are not overwritten

### Requirement: Staff edit prices
Staff SHALL be able to change any service base price, the extra-bathroom price, and any add-on price or active flag from `/staff/pricing`.
Every save SHALL increase the price list version by one, atomically with the price change.

#### Scenario: Saving a new price
- **WHEN** staff change the deep clean 2-bedroom price from 21000 to 22500 cents and save
- **THEN** the stored price is 22500 cents
- **AND** the price list version is one higher than before

#### Scenario: Invalid amount
- **WHEN** staff enter a negative or non-numeric price and save
- **THEN** nothing is saved, the version does not change, and the form shows which field is invalid
