# Spec Delta

## ADDED Requirements

### Requirement: Tours are matched by name, not only by exact slug
The quote and departure tools SHALL accept a tour named loosely by the model, matching it when the text is the tour's slug or contains exactly one tour's slug as a word, and SHALL treat text that matches no tour or several tours as an unknown tour.

#### Scenario: Model passes the customer's words
- **WHEN** the model calls the quote tool with "Sylhet tour" for 2 travelers
- **THEN** the customer gets the Sylhet tea gardens quote

#### Scenario: Text names two tours
- **WHEN** the model passes "Sylhet or Bandarban"
- **THEN** the tool reports an unknown tour and asks which one

### Requirement: Prices are shown in taka
Every amount in an agent reply SHALL be shown with the taka sign (৳); an amount the model writes with ₹, ₨ or Rs SHALL be rewritten with ৳ and checked by the price guard.

#### Scenario: Model writes the rupee sign
- **WHEN** the model replies "(₹8,500 per person)" after a quote of ৳8,500 per person
- **THEN** the customer sees "(৳8,500 per person)"
