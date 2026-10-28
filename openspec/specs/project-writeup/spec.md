# project-writeup Specification

## Purpose
Explains to a technical reader how Front Desk is built, why, and what was hard, on a public page next to the demo itself.

## Requirements

### Requirement: Architecture explained
`/how-it-works` SHALL show the architecture diagram (web chat and Kapso webhook into one agent core, out through channel adapters) and explain the main decisions in plain language.

#### Scenario: Reader opens the page
- **WHEN** a visitor opens `/how-it-works`
- **THEN** they see the diagram and a short section on each of: the channel adapter, grounded prices, the webhook pipeline, ownership and handoff, and the reply window

### Requirement: Honest notes on Kapso
`/how-it-works` SHALL include a "What tripped me up on Kapso" section listing real problems met while building, each with what happened and what was done about it.

#### Scenario: Section present
- **WHEN** a visitor reads the page
- **THEN** the section lists at least three concrete issues taken from the build notes, with no invented ones

### Requirement: Page meets site standards
`/how-it-works` SHALL carry the demo banner, follow the system color scheme, read well at 360px wide, and link back to the demo and to the repository once it is public.

#### Scenario: Phone in dark mode
- **WHEN** the page is opened at 360px wide in dark mode
- **THEN** the diagram and text are readable and nothing scrolls sideways
