# Tasks

## 1. Typing indicator

- [x] 1.1 Add `showTyping` to the adapter interface and the WhatsApp adapter, and teach the fake Kapso to record read receipts apart from sends; verify a test that the receipt carries the message id and a text typing indicator
- [x] 1.2 Call it from the Kapso handler alongside the turn, and verify integration tests: the receipt goes out before the reply, a rejected receipt still sends the reply, an image gets no receipt
- [ ] 1.3 Send a message from a real phone and verify the typing indicator shows until the reply arrives

## Workflow follow-up

- Run `/opsx:verify`, then `/opsx:archive`.
