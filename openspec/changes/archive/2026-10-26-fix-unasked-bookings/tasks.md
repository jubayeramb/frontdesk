# Tasks

## 1. Bookings need a pick

- [x] 1.1 Add a helper that tells whether text names a departure's day and month; verify unit tests for "1 Nov", "Nov 1st", "1st November", "the 1st of November", "M2", "2", "Sunday", "11 Nov" against 1 Nov, and "1 Dec"
- [x] 1.2 Pass the customer's latest message to the tools, from the stored message on a retry, and have `bookDeparture` book only a picked departure, offering the departures otherwise; verify integration tests for a tap, a named date, "M2" with a model that books anyway, and a retried turn

## 2. Temperature

- [x] 2.1 Run every model call at temperature 0.2; verify a test on the call settings

## 3. Ids in replies

- [x] 3.1 Write a bare departure id in a reply as its date, as seen in the first "M2" replay; verify a unit test with the live text and a plain ISO date left alone

## 4. Real model

- [x] 4.1 Replay quote, dates and "M2" three times on the real model, and verify no run books; then tap a date in the terminal chat and verify it books
- [x] 4.2 On the phone, send meaningless text after the departures and verify no booking and the departures offered again (sent "L99"), then tap a date and verify the booking
