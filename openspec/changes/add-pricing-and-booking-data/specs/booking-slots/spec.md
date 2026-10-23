# Spec Delta

## Purpose

Offers customers real cleaning appointments for the coming week and books exactly one customer into each appointment.

## ADDED Requirements

### Requirement: Available slots for the next 7 days
The system SHALL offer two slots a day, at 9:00 and 13:00 America/Chicago time, for the next 7 calendar days, excluding slots that have already started and slots that are booked.

#### Scenario: Normal week
- **WHEN** available slots are requested on a Monday at 08:00 Austin time with no bookings
- **THEN** 14 slots are returned, starting with Monday 9:00, in time order

#### Scenario: Slot already started
- **WHEN** available slots are requested at 10:30 Austin time
- **THEN** today's 9:00 slot is not offered and today's 13:00 slot is

#### Scenario: Booked slot
- **WHEN** Tuesday 13:00 is booked
- **THEN** Tuesday 13:00 is not in the available slots

#### Scenario: Daylight saving change
- **WHEN** the 7-day window crosses a daylight saving change
- **THEN** every slot is still at 9:00 or 13:00 local Austin time

### Requirement: Booking a slot
The system SHALL book an available slot for a conversation and store a snapshot of the quote, including its price list version.
A slot SHALL never be booked twice.

#### Scenario: Successful booking
- **WHEN** a customer books an available slot with a quote
- **THEN** the booking is stored with the slot start time and the quote snapshot
- **AND** the slot no longer appears as available

#### Scenario: Two customers race for one slot
- **WHEN** two bookings for the same slot are attempted at the same time
- **THEN** exactly one succeeds
- **AND** the other gets a "slot taken" result, not an error

#### Scenario: Slot outside the window
- **WHEN** a booking is attempted for a time that is not an offered slot or has already started
- **THEN** no booking is stored and the result says the slot is unavailable
