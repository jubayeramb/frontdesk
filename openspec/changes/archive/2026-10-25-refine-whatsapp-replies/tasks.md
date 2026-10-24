# Tasks

## 1. Typing indicator

- [x] 1.1 Add `showTyping` to the adapter interface and the WhatsApp adapter, and teach the fake Kapso to record read receipts apart from sends; verify a test that the receipt carries the message id and a text typing indicator
- [x] 1.2 Show it for newly stored messages the agent will answer, alongside the processing, and verify integration tests: the receipt goes out before the reply, a rejected receipt still sends the reply, an image gets no receipt, a duplicate delivery gets one receipt
- [x] 1.3 Send a message from a real phone and verify the typing indicator shows until the reply arrives

## 2. Readable options

- [x] 2.1 Send choices as buttons only when every label fits a button title, and verify a render test that the three tours go as a list with the full Sundarbans label
- [x] 2.2 Give choices a short label from the tool that builds them and use it for the list button, and verify render tests for a label, a label cut to fit, and an older reply without one
- [x] 2.3 Reword the options rule and tool note without naming a widget, drop list lines that repeat the options, and verify unit and turn tests plus a live replay with no mention of buttons
- [x] 2.4 On a real phone, ask for the tours and the departures, and verify full labels, list buttons that say what they open, and lead-in text that names no widget

## Workflow follow-up

- Run `/opsx:verify`, then `/opsx:archive`.
