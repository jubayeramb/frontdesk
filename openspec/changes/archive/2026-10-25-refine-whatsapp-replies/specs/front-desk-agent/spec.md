# Spec Delta

## ADDED Requirements

### Requirement: Options are introduced, not repeated
When a turn offers options, the reply text SHALL lead into them without repeating them or describing how they are shown, since each channel shows them in its own way.
List lines in the reply that only repeat an option label SHALL be removed.

#### Scenario: Model lists the departures
- **WHEN** the model replies "These are the next departures for the Sylhet tour:" followed by "- Fri 6 Nov" and "- Fri 13 Nov", and those are the offered options
- **THEN** the text reply is "These are the next departures for the Sylhet tour." and the departures arrive only as options

#### Scenario: Customer asks what tours there are
- **WHEN** a customer asks which tours are available
- **THEN** the reply text does not mention buttons, tapping or where the options appear
