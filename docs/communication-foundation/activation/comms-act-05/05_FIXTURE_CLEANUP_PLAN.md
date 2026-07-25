# COMMS-ACT-05 — Fixture / Cleanup Plan

## Marker

`COMMS_ACT_05_SMOKE_FIXTURE_`

Applied to deterministic conversation / message / context_ref / idempotency keys used only for smoke.

## Create (after Owner GO only)

1. Prefer existing Staging identities (ACT-04 inventory).
2. Insert Communication rows only via trusted backend commands.
3. Tag bodies / context_ref / idempotency keys with marker.

## Cleanup package

- SQL or script deletes rows where marker matches across:
  - `communication_messages`
  - `communication_conversation_participants`
  - `communication_conversations`
  - `communication_read_cursors`
  - `communication_pinned_messages`
  - `communication_message_reports`
  - `communication_idempotency`
- Verify count of marker rows = **0** before ACT-05 closure.
- Never drop schema; never touch Production.

## Auth / membership

Cleanup must **not** delete `auth.users`, `profiles`, or `club_members` rows.
