# TT-5D Correction Workflow

## Table

`team_tournament_referee_correction_requests` — pending → approved | rejected | cancelled

## Flow

1. Referee: `team_tournament_request_referee_correction` (match finalized, active assignment, no pending request).
2. BTC: `team_tournament_review_referee_correction` — approve | reject (reason on reject).
3. Approve → `referee_v5_apply_admin_result_revision` (overridden) → outbox → `team_tournament_consume_referee_v5_outbox`.
4. Reject → official result unchanged; audit only.

## Idempotency

- `request_id` unique per tenant/tournament
- Command idempotency via `team_tournament_begin_command`
