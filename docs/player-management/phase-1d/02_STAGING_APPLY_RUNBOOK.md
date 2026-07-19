# 02 — Staging Apply Runbook (Phase 1D)

**Status:** Owner-gated. Do **not** apply from CI. Do **not** use Production credentials.

## Prerequisites

- [ ] Owner approval for Staging apply / re-verify
- [ ] Confirm project is Staging (`qyewbxjsiiyufanzcjcq` / staging pooler) — **never** Production (`expuvcohlcjzvrrauvud`)
- [ ] Forward SQL reviewed: `docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION.sql`
- [ ] Verify SQL ready: `docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION_VERIFY.sql`
- [ ] Rollback staged: `docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION_ROLLBACK.sql`
- [ ] Optional backup/export of `public.profiles` columns listed in rollback header
- [ ] Phase C helpers present (`is_super_admin`, `user_has_permission`, `user_venue_id`)

## If schema already applied (idempotent re-apply)

Phase 1D forward SQL is idempotent for columns/constraints/index. Re-running is safe and will refresh the guard function to the hotfixed body.

## Apply steps (human operator)

1. Open Supabase SQL editor for **Staging only** (or `psql` against Staging `SUPABASE_DB_URL`).
2. Run `docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION.sql` in one session.
3. Run `docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION_VERIFY.sql`.
4. Confirm:
   - All five foundation columns present (+ existing `birth_year`)
   - `privacy_null = 0`, `verification_null = 0`
   - `no_current_user_postgres_bypass = true`
   - `has_self_verification_block = true`
5. Smoke (authenticated Staging user, non-destructive):
   - Self may update `handedness` (or restore after)
   - Self **cannot** set `identity_verification_status`
6. Confirm app self-profile save (displayName / birthYear) still works via Player Management runtime path.

## Abort / rollback

- Mid-transaction failure → automatic rollback.
- Post-apply product reject → Owner-approved rollback SQL **after** export (column drops lose field data).

## After Staging green

- Do **not** Production-apply (see `03_PRODUCTION_HOLD_GATE.md`).
- Do **not** start Phase 1E unless Owner approves.
- Optional: record verify output under `docs/v5/qa-evidence/` in a follow-up docs commit.
