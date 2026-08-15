# Daily Play cross-tournament court occupancy

**DO NOT APPLY WITHOUT OWNER GO STAGING.**

This additive package updates `public.daily_play_snapshot` so `daily_play_get_state`
returns club-wide sanitized court occupancy. The implementation run that produced
it used `STAGING_MUTATIONS=0`; nothing here was applied to Staging or Production.

## Why this exists

A physical court belongs to the club/tenant inventory. Active Daily Play leases
are unique on `(tenant_id, club_id, court_id)` where `status = 'active'`.

`daily_play_assign_court` already honors that club-wide unique protection.
`daily_play_snapshot` previously projected `activeLeases` for the **current
tournament only**, so a later Daily session could show a globally occupied court
as available.

## Contract after APPLY

`daily_play_get_state` / `daily_play_snapshot` returns:

1. current tournament Daily state (unchanged isolation)
2. canonical club court inventory from `club_data_v3` (unchanged)
3. current-tournament `activeLeases` detail (unchanged scope)
4. club-wide sanitized `occupiedCourtIds` = `[courtId, ...]`

`occupiedCourtIds` is filtered by `tenant_id + club_id + status='active'` and
**not** by `tournament_id`. It contains court IDs only. It does not include
other tournament names, match IDs, players, or scores.

The unique active court index is unchanged. No table DML. No backfill. No
lease release/acquisition.

## Run order after Owner GO

1. `01_PRECHECK.sql` — prove current canonical Daily snapshot/get_state and the
   unique active court index exist; fail closed on signature drift or a
   conflicting occupancy projection.
2. `02_APPLY.sql` — replace only `daily_play_snapshot`.
3. `03_VERIFY.sql` — occupancy field, lease-detail isolation, unique index,
   grants, no client table exposure.
4. Owner Preview retest only after Staging APPLY.
5. `04_ROLLBACK.sql` only if rollback is approved. It restores the prior
   snapshot body. No data deletion. No lease mutation.

## Security

`daily_play_snapshot` remains an internal `SECURITY DEFINER` helper with
`search_path = public` and no client EXECUTE. Callers still go through
`daily_play_get_state` (`authenticated` only, anon denied, tenant asserted).
