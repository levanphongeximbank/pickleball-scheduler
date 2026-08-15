# Official / Open — referee → scoring → completion 01

**LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.**

`STAGING_SQL_MUTATIONS` for this authoring turn: **0**
`PRODUCTION_MUTATIONS`: **0**

This package is the consolidated server command surface for Official/Open
match-day runtime through tournament completion.

It does **not**:

- reopen court booking / venue timezone / `court_reservations` / occupancy / backfill
- apply or modify `docs/v5/migrations/official-open-sideout-runtime-01/`
- mutate fixture `a5d7661a-6967-4f12-86f6-fd92a2d30de9`
- replace `canonical_tournament_update`

## Authority

| Object | Role |
|---|---|
| `canonical_tournaments` | Final competition SSOT (sole Tournament `version`) |
| `tournament_match_live` | Execution model only (live Rally scoreboard) |
| `official_open_lifecycle_commands` | Idempotency ledger (`request_hash` required) |

Rally is the operable scoring method. Side-out remains fail-closed / deferred.

## Run order after Owner GO Staging

1. `01_PRECHECK.sql` — read only
2. `02_APPLY.sql` — schema + RPCs, one transaction
3. `03_VERIFY.sql` — read only
4. `04_ROLLBACK.sql` — **fail closed** if ledger rows or live runtime fields exist

## RPCs

Authenticated Organizer (`tournament.update`):

- `official_open_ensure_match_live`
- `official_open_revoke_match_live`
- `official_open_admin_commit_match_result` (expected_version CAS)
- `official_open_generate_knockout` (expected_version CAS, qualification fail-closed)
- `official_open_complete_tournament` (re-checks qualification)
- `official_open_get_public_results` (authenticated sanitized DTO)

Anon + authenticated token console:

- `official_open_referee_get_match`
- `official_open_adjust_live_score` (`FOR UPDATE` + expected score snapshot)
- `official_open_commit_match_result`

Token commit concurrency: **SERVER_ROW_LOCK_SERIALIZED**
(lock live row, lock canonical Tournament, patch exact match, `version++`).
No client `expected_version`. No full-payload overwrite. Response is sanitized
(no canonical blob, no referee tokens).

## Idempotency

Same key + same `request_hash` → replay stored sanitized response.
Same key + different `request_hash` → `IDEMPOTENCY_CONFLICT`.

## Qualification (server = UI)

`matchPoints` win=2 / loss=1 / forfeit=0, then scoreDiff, pointsFor, wins.
Name must not decide qualification. Boundary sporting tie →
`QUALIFICATION_TIE_UNRESOLVED`.

## Identity

Referee access remains **token-based**. Strong user-identity binding is deferred.
Unassign rotates the live token so the previous URL fails closed.
