# Daily Play end-to-end canonical remediation

**DO NOT APPLY WITHOUT OWNER GO STAGING.**

This is a local SQL migration package. The implementation run that produced it used
`STAGING_MUTATIONS=0`; nothing in this package was applied to Staging or Production.

## Canonical ownership

- Tournament/state SSOT: `public.canonical_tournaments`, restricted to `mode = 'daily_play'`.
- Operational JSON state: `payload.settings.dailyPlay`.
- CAS authority: integer `payload.settings.dailyPlay.revision`.
- Court inventory SSOT: `public.club_data_v3.data.courts`.
- Court occupancy: `public.daily_play_court_leases`.
- Command replay/idempotency: `public.daily_play_command_ledger`.
- There is deliberately **no `daily_play_courts` inventory table**.

An absent or empty `enabledCourtIds` setting enables every usable club court.
A non-empty `enabledCourtIds` array is an explicit allow-list. Usable inventory
filters out inactive courts and courts whose status is `locked` or `maintenance`.

Daily Play state uses:

```json
{
  "revision": 0,
  "checkedInPlayerIds": [],
  "matches": []
}
```

Each match stores at least `id`, `playerIds`, `status`, and `courtId`. Accepted
active statuses are `waiting`, `assigned`, and `playing`; terminal statuses are
`completed` and `cancelled`.

## Run order after Owner GO

1. `01_PRECHECK.sql` — read-only dependency check.
2. `02_APPLY.sql` — transactional DDL/RPC installation.
3. `03_VERIFY.sql` — read-only post-apply object, signature, index, and grant checks.
4. Exercise the RPCs with a dedicated Staging fixture and explicit expected revisions.
5. `04_ROLLBACK.sql` only if rollback is approved.

`03_VERIFY.sql` is intentionally a post-apply script. It does not assume this local
implementation run applied anything to Staging.

## Security and behavior

All public RPCs are `SECURITY DEFINER`, pin `search_path = public`, call the canonical
tenant/permission assertions, and are executable by `authenticated` only. Table
access and helper execution are not granted to clients.

Write RPCs use row locking plus an atomic revision predicate. A stale expected
revision returns `VERSION_CONFLICT` with the actual revision. Active court leases are
protected by a partial unique index. Court changes acquire the target lease before
releasing the old lease, so a busy target cannot disturb the existing assignment.

Rollback drops only this package's RPCs, helpers, ledger, and lease table. It never
modifies or deletes `canonical_tournaments` or `club_data_v3` data.
