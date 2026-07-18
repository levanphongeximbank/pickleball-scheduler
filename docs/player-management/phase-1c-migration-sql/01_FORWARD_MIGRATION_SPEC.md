# 01 — Forward Migration Spec

## File

`docs/v5/PHASE_1C_PLAYER_PROFILE_FOUNDATION.sql`

## Ordering

1. `BEGIN`
2. `ADD COLUMN IF NOT EXISTS` for five Phase 1C columns
3. Column comments (Player Management foundation — not RBAC)
4. Explicit `UPDATE` privacy_settings where NULL → fail-closed object
5. Named CHECK constraints via idempotent `DO $$ … $$` / `pg_constraint` probe
6. Partial index on `identity_verification_status` where `IS DISTINCT FROM 'unverified'`
7. Replace `profiles_guard_privileged_update` to block self-change of verification; allow `user.manage` / super_admin path for others
8. Recreate trigger
9. `COMMIT`

## Idempotency

| Object | Strategy |
|--------|----------|
| Columns | `ADD COLUMN IF NOT EXISTS` |
| Constraints | Skip if `conname` already on `public.profiles` |
| Index | `CREATE INDEX IF NOT EXISTS` |
| Function/trigger | `CREATE OR REPLACE` + `DROP TRIGGER IF EXISTS` / recreate |

## Transaction

Single transaction (`BEGIN`/`COMMIT`). Supported on Supabase SQL editor / `psql`. If a statement fails, roll back the whole apply.

## Compatibility with existing rows

- New nullable columns remain NULL (`birth_date`, `handedness`, `activity_region`)
- `identity_verification_status` filled with `'unverified'` via `NOT NULL DEFAULT`
- `privacy_settings` backfilled to fail-closed jsonb
- Existing `birth_year` / `gender` / `player_id` untouched
- No `DROP COLUMN`, no row deletes, no Competition tables

## Conflict: birth_date vs birth_year

**No DB consistency CHECK** in this wave (legacy-safe). App-owned: prefer `birth_date` on read when present; do not invent DOB from year.
