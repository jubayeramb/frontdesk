# Tasks

## 1. Retry promptly

- [x] 1.1 Back off a failed event by 5 seconds times its attempts and let `drain` carry on, and verify integration tests: a turn that fails once is answered by the same drain with no other request, and an event that fails 3 times is marked failed while the next one runs

## 2. Finish interrupted turns

- [x] 2.1 Let `runTurn` run for an already stored message, and verify the turn stores no second copy
- [x] 2.2 Resume a retried `message.received` from what follows its stored message, and verify integration tests for no reply, unsent replies, and an answered message, plus a person owning the conversation and a contact over its limit staying silent

## 3. Real phone

- [x] 3.1 Reproduce an interrupted turn end to end: stop the dev server while a message from the phone is mid-turn, start it again, and verify the phone gets one reply once a sweep picks the event up
- [x] 3.2 Update `AGENTS.md` on webhook retries, and verify it matches the code

## Workflow follow-up

- Run `/opsx:verify`, then `/opsx:archive`.
