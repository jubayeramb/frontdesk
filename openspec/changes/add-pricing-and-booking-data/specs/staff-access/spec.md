# Spec Delta

## Purpose

Keeps every staff page private behind a shared password, because staff pages can change prices and, later, message customers.

## ADDED Requirements

### Requirement: Staff pages require a password
Every page and action under `/staff` SHALL require a valid staff session.
A request without one SHALL be sent to the staff sign-in page, and a staff action without one SHALL be refused.

#### Scenario: Visitor opens a staff page
- **WHEN** a visitor without a staff session opens `/staff/pricing`
- **THEN** they see the staff sign-in page and no pricing data

#### Scenario: Action without a session
- **WHEN** a request to save prices arrives without a staff session
- **THEN** it is refused and nothing is saved

### Requirement: Signing in and out
Staff SHALL sign in with the shared staff password and receive a session that lasts 7 days at most.
A wrong password SHALL not reveal whether a session exists or what the password looks like.
Staff SHALL be able to sign out.

#### Scenario: Correct password
- **WHEN** staff enter the correct password
- **THEN** they are taken to the page they originally asked for

#### Scenario: Wrong password
- **WHEN** someone enters a wrong password
- **THEN** they stay on the sign-in page with a generic "wrong password" message

#### Scenario: Password rotated
- **WHEN** the staff password or session secret changes
- **THEN** existing sessions stop working
