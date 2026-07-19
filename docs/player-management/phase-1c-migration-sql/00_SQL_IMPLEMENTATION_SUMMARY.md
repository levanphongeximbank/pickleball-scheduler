# 00 — SQL Implementation Summary

**Wave:** Phase 1C migration SQL authoring only
**Branch:** `feature/player-phase-1c-migration-sql`
**Approved design base:** `117c40f47c54636f9eddcbca586289567d25d889`
**Source of truth:** `docs/player-management/phase-1c-migration-design/05_RECOMMENDED_SCHEMA_DESIGN.md`

## Verdict (authoring)

**PASS WITH AUTHORIZATION WIRING REQUIRED**

Schema + constraints + fail-closed privacy backfill + self-update guard for `identity_verification_status` are authored. Durable `updatePlayerProfile` persistence and dedicated admin verification RPC/UI remain out of scope.

## Package layout

| Artifact | Path |
|----------|------|
| Forward migration | `docs/v5/PHASE_1C_PLAYER_PROFILE_FOUNDATION.sql` |
| Rollback SQL | `docs/v5/PHASE_1C_PLAYER_PROFILE_FOUNDATION_ROLLBACK.sql` |
| Verification SQL | `docs/v5/PHASE_1C_PLAYER_PROFILE_FOUNDATION_VERIFY.sql` |
| Docs (this folder) | `docs/player-management/phase-1c-migration-sql/` |

## Columns added on `public.profiles`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `birth_date` | `date` | YES | NULL |
| `handedness` | `text` | YES | NULL |
| `activity_region` | `jsonb` | YES | NULL |
| `privacy_settings` | `jsonb` | YES | fail-closed object |
| `identity_verification_status` | `text` | NO | `'unverified'` |

**Retained:** `birth_year`, `gender`, `player_id`, account/RBAC fields.

## Explicit non-goals (this package)

- No Staging/Production apply
- No `birth_date` invention from `birth_year`
- No GIN on `activity_region`
- No Competition/Club/Venue/Rating/Ranking schema changes
- No Phase 1D / runtime persistence wiring
- No commit / push / PR from this task alone
