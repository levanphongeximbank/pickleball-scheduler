# Daily Play canonical score correction

**DO NOT APPLY WITHOUT OWNER GO STAGING.**

This additive package installs `public.daily_play_correct_score`. The implementation
run that produced it used `STAGING_MUTATIONS_THIS_RUN=0`; nothing here was applied
to Staging or Production.

## Why this exists

`daily_play_submit_score` remains the only command that finalizes a **playing**
match. Completed scores are immutable through that RPC (identical replay only).

Director correction of a completed Daily score is a distinct audited command:

- match status stays `completed`
- no court lease is created or reacquired
- players stay released
- canonical final score is replaced
- `scoreLog` appends oldScore → newScore
- CAS `expectedVersion` + idempotency
- Daily Play Rating/VPR stays excluded by design

## Run order after Owner GO

1. `01_PRECHECK.sql` — prove the Daily Play end-to-end canonical package exists.
2. `02_APPLY.sql` — install only `daily_play_correct_score`.
3. `03_VERIFY.sql` — signature, SECURITY DEFINER/search_path, authenticated execute,
   anon denied, no direct table grants, CAS/audit contract.
4. Browser-test DP-14 correction only after this package is installed on Staging.
5. `04_ROLLBACK.sql` only if rollback is approved. It drops this RPC only.

## Security

The RPC is `SECURITY DEFINER`, pins `search_path = public`, asserts tenant and
`tournament.update`, and is executable by `authenticated` only.

Rollback does not touch `canonical_tournaments`, `club_data_v3`, leases, or the
existing Daily Play RPC set.
