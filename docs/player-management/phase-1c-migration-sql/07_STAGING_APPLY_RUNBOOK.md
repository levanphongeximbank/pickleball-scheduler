# 07 — Staging Apply Runbook

**Status:** Authored — **NOT executed** by this SQL authoring task.

## Prerequisites

- [ ] Owner approval for Staging apply
- [ ] Staging project identified (do not use Production credentials)
- [ ] Forward SQL reviewed: `docs/v5/PHASE_1C_PLAYER_PROFILE_FOUNDATION.sql`
- [ ] Rollback SQL staged: `docs/v5/PHASE_1C_PLAYER_PROFILE_FOUNDATION_ROLLBACK.sql`
- [ ] Backup / export plan for `public.profiles` confirmed
- [ ] Phase C identity SQL already present (`profiles_guard_privileged_update` exists)

## Apply steps (human operator)

1. Open Supabase SQL editor for **Staging only**.
2. Paste / run forward migration in one session.
3. Run verification: `docs/v5/PHASE_1C_PLAYER_PROFILE_FOUNDATION_VERIFY.sql`.
4. Record counts from sanity query (`privacy_null` should be 0).
5. Optionally run negative probes from `06_STATIC_VERIFICATION_SQL.md`.
6. Confirm existing self profile update (display_name / birth_year) still works.
7. Confirm self cannot set `identity_verification_status` to `verified`.

## Abort / rollback

If apply fails mid-transaction → automatic rollback.
If apply succeeds but product rejects → Owner-approved run of rollback SQL after export.

## After Staging green

Do **not** Production-apply. Proceed only via `08_PRODUCTION_HOLD_GATE.md` + Owner decision.
Do **not** wire `updatePlayerProfile` durable persistence until a separate approved task.
