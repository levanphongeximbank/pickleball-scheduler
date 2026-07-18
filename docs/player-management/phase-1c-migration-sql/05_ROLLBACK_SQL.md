# 05 — Rollback SQL

## Executable file

`docs/v5/PHASE_1C_PLAYER_PROFILE_FOUNDATION_ROLLBACK.sql`

## Pre-rollback warning (mandatory)

1. **Export / backup** rows for the five Phase 1C columns before DROP.
2. Dropping columns is **data-loss** for those fields only.
3. Does **not** touch `birth_year`, `gender`, `player_id`, or account/RBAC columns.
4. **Do not execute** until Owner approves rollback on the target environment.

## Reverses only

1. Restores Phase C `profiles_guard_privileged_update` (without verification field)
2. Recreates trigger
3. Drops partial index
4. Drops six named CHECK constraints
5. `DROP COLUMN IF EXISTS` for: `birth_date`, `handedness`, `activity_region`, `privacy_settings`, `identity_verification_status`

## Transaction

Wrapped in `BEGIN` / `COMMIT`.

## Not in rollback

- No Competition/Club/Venue/Rating changes
- No deletion of profile rows
- No modification of `birth_year`
