# Tasks

## 1. Transcript

- [x] 1.1 Add `channel`, the `person` and `note` senders, `owner` and `whatsapp` to the transcript, mapped like `/c`; verify integration tests for a linked conversation with a staff reply and notes
- [x] 1.2 While a person owns the conversation, store the web message and return the fixed WhatsApp notice without running a turn, also for a resubmitted nonce; verify integration tests

## 2. Panel

- [x] 2.1 Render the WhatsApp marker, "Triplone Tours team", notes and the status strip; verify at 360px and 1280px in light and dark
- [x] 2.2 Poll the transcript every 5 seconds while open and visible, keeping lines still sending or failed; verify e2e that a WhatsApp message added in the database appears without a reload, and that a send during polling shows once
- [x] 2.3 Record the takeover before the inbox reply that caused it, so "A person joined" reads above that reply; verify the integration test fails before and passes after

## 3. Phone

- [x] 3.1 From a real phone and the web: continue a chat on WhatsApp, verify WhatsApp replies show up in the open panel, then take over from the inbox and verify the panel's notice when sending from the web
