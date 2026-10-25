# Design

## Context

Web conversations live under a contact with a `web` identity; WhatsApp numbers are `whatsapp` identities (add-agent-core).
The web branch of `requestHuman` returns a plain `wa.me` link (add-human-handoff).

## Goals / Non-Goals

**Goals:**
- Linking is one transaction: no half-linked state if two messages race.
- The code never reaches the model as something to act on.

**Non-Goals:**
- Merging two contacts' full histories into one conversation.
- Linking in the other direction (WhatsApp to web).

## Decisions

### Code format

`TR-` plus 6 characters from Crockford base32 without `I`, `L`, `O`, `U` (32 symbols, about 1 billion codes).
Parsing is case-insensitive, tolerates spaces after `TR-`, and reads look-alikes the Crockford way (`O` as `0`, `I` and `L` as `1`).
A code always holds at least one letter, and an all-digit match is skipped, so a booking reference such as `TR-100006` is never read as a code.
With two codes in one message, the first counts.
`link_codes(code pk, conversation_id, expires_at, used_at, used_by_identity)`.

### Link transaction

On `message.received`, before the turn:
1. Find a code in the text.
   None: normal turn.
2. `UPDATE link_codes SET used_at = now(), used_by_identity = $id WHERE code = $c AND used_at IS NULL AND expires_at > now() RETURNING conversation_id`.
   No row: if this number already used the code (a retried message), it still counts; otherwise the turn is told the code is expired or used.
3. In the same transaction: re-point the WhatsApp identity to the web contact, close the number's other open conversation if any (kept, `closed_at` set), set the web conversation's `kapso_conversation_id` and `wa_last_inbound_at`, and store the inbound message on it.
4. Run the turn. The inbound message is stored as the customer wrote it, with `payload.link` set to `continued` or `rejected`; the model sees a fixed sentence for it ("I'm continuing my website chat here on WhatsApp." or "I have a code from the website chat, but it has expired or was already used.") and never the code.
   A system note "Customer continued from the website on WhatsApp." marks the move for staff and the timeline.

Lookups for "the conversation behind this identity" skip closed conversations.

The atomic `UPDATE ... RETURNING` makes single use hold under races without a lock.

### continueOnWhatsApp

Web-only tool, not offered on WhatsApp.
Returns a `link` reply with `https://wa.me/<number>?text=` plus the URL-encoded prefilled message.
`requestHuman` on the web calls the same code path.

### Timeline

`/c` is a server component reading the conversation from the chat cookie, plus the same small client component as `/staff` that calls `router.refresh()` every 5 seconds while the tab is visible.
One refresh pattern across the app beats a second, `since`-based API shape for a page that shows at most 200 messages.
The chat widget's header links to `/c`.
Rows render `customer`, `ai` and `human` messages; `system` messages render only for ownership changes and the move to WhatsApp, as a plain line ("A person joined", "Continued on WhatsApp").
Links and suppressed replies are left out; offered options show as plain labels.

Alternative: server-sent events.
Nicer, but long-lived connections on serverless cost more than 5-second polls for a page few people keep open.

## Risks / Trade-offs

- [Someone guesses a code] → 1 billion codes, 15 minutes, single use; a guess also only joins a stranger's tour quote, which holds no personal data by design.
- [Visitor edits the prefilled message and deletes the code] → They get a fresh WhatsApp conversation; the web history is not lost, only unlinked.
- [Re-pointing an identity hides an older WhatsApp conversation from the agent] → It is closed, not deleted, and still visible in Kapso's inbox.
