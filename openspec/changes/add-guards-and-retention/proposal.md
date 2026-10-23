# Proposal

## Why

A public number and a public chat on a free model tier will meet bored strangers, scripts, and stickers.
WhatsApp also refuses free-form messages 24 hours after the customer's last message, and keeping strangers' chats forever is not acceptable for a demo.

## What Changes

- Enforce the 24-hour reply window in the WhatsApp adapter's `replyPolicy`, and show a countdown on `/c` and `/staff`.
- Add per-contact limits (20 turns an hour, 60 a day) and a global daily cap below Groq's daily limit.
  Over a limit, send one fixed reply without calling the model.
- Ignore reactions, statuses and our own echoes.
  Reply "I can only read text for now" to media and other unsupported message types.
  Cut very long messages before they reach the model.
- Delete conversations, messages, bookings, link codes and processed webhook events older than 7 days with a daily Vercel cron.

Out of scope: Kapso's own retention of WhatsApp messages (documented in deploy-and-document), CAPTCHA, IP-based blocking.

Phase 8.
Depends on add-cross-channel-linking (timeline) and add-human-handoff (staff page).

## Capabilities

### New Capabilities

- `reply-window`: WhatsApp's 24-hour customer service window and how it is shown.
- `usage-limits`: per-contact and global turn limits that protect the model budget.
- `inbound-filtering`: which inbound WhatsApp messages reach the agent and how unsupported ones are answered.
- `data-retention`: how long conversation data is kept and how it is deleted.

### Modified Capabilities

None.

## Impact

- New: `src/lib/guards.ts`, `turns` table, `src/app/api/cron/retention/route.ts`, `vercel.json` cron entry.
- New env vars: `CRON_SECRET`, `GLOBAL_DAILY_TURN_CAP`.
