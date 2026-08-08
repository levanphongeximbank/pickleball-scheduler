# Staging rehearsal — TT4 withdrawal columns

Date: 2026-08-08

## Package
- `docs/v5/migrations/tournament-create-and-team-schema-remediation-01/10_TT4_TEAM_WITHDRAWAL_COLUMNS.sql`
- SHA256: `f12d4a3daeb8e9191a514b0955b042a1cc576d66a65061e794be511f8ad73c53`

## Staging before
Columns `withdrawn`, `withdrawn_at`, `withdrawal_reason` already present on `public.team_tournament_teams`.
`team_tournament_get_setup` source references `t.withdrawn` / `t.withdrawn_at`.

## Apply
Migration name: `tt4_team_withdrawal_columns_remediation_01` (idempotent `ADD COLUMN IF NOT EXISTS`).

## After
- Columns present: withdrawn, withdrawn_at, withdrawal_reason
- Projection query using `coalesce(t.withdrawn, false)` succeeds (no missing-column error)
- `team_tournament_get_setup('__nonexistent__', ...)` returns `{ok:false, code:NOT_AUTHENTICATED}` (not column error)

## Production
NOT applied. Requires separate Owner GO.
