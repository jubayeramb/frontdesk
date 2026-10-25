# Tasks

## 1. Header

- [x] 1.1 Add `SiteHeader` with the name, "Chat" (`/#chat`) and "Staff" links, render it under the banner on `/` and on `/c`; verify it at 360px and 1280px in light and dark
- [x] 1.2 Open the chat panel when the hash is `#chat`, on load and on `hashchange`, and clear the hash when it closes; verify e2e from `/` and from `/c`, and that a reload after closing keeps it closed

## 2. WhatsApp button

- [x] 2.1 Add `whatsappStartLink` and the two hero buttons; verify a unit test for the link and an e2e check of both buttons
- [x] 2.2 From a real phone, tap "Chat on WhatsApp" on the tunnel URL, send the greeting, and verify the agent answers with no link code involved (a number with an open conversation continues it)

## 3. Phone fixes

- [x] 3.1 Allow tunnel and local network origins in development; verify a phone viewport on the tunnel and on the LAN address opens the chat panel
- [x] 3.2 Add "Conversation" to the header, linking to `/c`; verify e2e and at 360px
