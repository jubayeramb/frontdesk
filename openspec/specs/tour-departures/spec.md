# tour-departures Specification

## Purpose
Offers customers real tour departures for the next two weeks and records a booking against one.

## Requirements

### Requirement: Departures for the next 14 days
The system SHALL offer each active tour's departures on its fixed weekdays for the next 14 days, in Asia/Dhaka time, in date order, excluding departures that leave within 48 hours.

#### Scenario: Sundarbans departures
- **WHEN** departures for the Sundarbans tour (Thursdays and Sundays) are requested on a Monday
- **THEN** the next four Thursday and Sunday departures are returned, in date order

#### Scenario: Departure too soon
- **WHEN** departures are requested on a Wednesday afternoon
- **THEN** Thursday's departure is not offered

### Requirement: Booking a departure
The system SHALL store a booking for an offered departure with the conversation, the number of travelers, and a snapshot of the quote including its price list version, and SHALL refuse a departure that is not offered.

#### Scenario: Successful booking
- **WHEN** a customer books an offered departure with a quote
- **THEN** the booking is stored with the departure date, travelers and the quote snapshot

#### Scenario: Departure not offered
- **WHEN** a booking is attempted for a date the tour does not leave on, or one within 48 hours
- **THEN** no booking is stored and the result says the departure is unavailable
