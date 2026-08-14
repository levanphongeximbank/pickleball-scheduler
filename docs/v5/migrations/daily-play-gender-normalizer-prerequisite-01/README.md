# Daily Play gender-normalizer prerequisite

**DO NOT APPLY WITHOUT OWNER GO.**

Standalone compatibility extraction for Daily Play PR #424.

Installs **only**:

`public.team_tournament_normalize_gender_key(text)`

This is the immutable gender-key normalizer already present on Staging (from
Team Tournament TT-2C). Production does not have it, so `#424`
`01_PRECHECK.sql` fails closed before APPLY.

This package does **not** install:

- `team_tournament_resolve_player_gender_key`
- lineup validation / MLP / Dreambreaker helpers
- tables, indexes, or DML
- athlete/profile/tournament/lease changes

## Semantics (do not extend)

Input: `trim + lower` (`coalesce` NULL → `''`).

| Aliases | Result |
|---|---|
| `nam`, `male`, `m` | `male` |
| `nữ`, `nu`, `female`, `f`, `n` | `female` |
| `other`, `khac`, `khác` | `other` |
| everything else, including NULL / `''` | `unknown` |

`LANGUAGE sql`, `IMMUTABLE`, `search_path=public`.

## Run order (future Production, plan only)

1. This package: `01_PRECHECK` → `02_APPLY` → `03_VERIFY`
2. Then `docs/v5/migrations/daily-play-canonical-session-close-final-lifecycle-01/`
   `01_PRECHECK` → `02_APPLY` → `03_VERIFY`

Do not reverse that order.

## Rollback order

1. Roll back `#424` Daily Play close/lifecycle package first.
2. Then this rollback, **only if** no remaining function references the helper.

If `#424` `daily_play_athlete_gender_key` (or any Team helper) still depends on
this function, `04_ROLLBACK.sql` raises `ROLLBACK_REFUSED` and does not DROP.

If the helper already existed (Staging Team Tournament), dependents remain and
rollback must **not** remove it.

## Grants

EXECUTE is granted to `PUBLIC`, `anon`, `authenticated`, and `service_role` to
preserve the established Staging helper contract. This package does not narrow
grants.
