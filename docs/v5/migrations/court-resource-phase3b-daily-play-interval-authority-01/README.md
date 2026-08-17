# Court Resource Phase 3B / 4D — Daily Play Interval Authority 01

**LOCAL AUTHORING + LOCAL RECERTIFICATION ONLY.**  
**DO NOT APPLY TO STAGING OR PRODUCTION IN THIS PASS.**

## Migration identity

```
D4_MIGRATION_VERSION=20260816074600
D4_MIGRATION_NAME=court_resource_phase3b_daily_play_interval_authority_01
```

This identity is **frozen before first Staging APPLY**. It is distinct from Phase 3B
version `20260815153624`. Staging migration history must use this exact version and
name. Do **not** generate a timestamp at execution time. If package source changes
after Staging APPLY, create a later additive migration rather than changing this
identity retrospectively.

Machine-readable copy: `MIGRATION_IDENTITY.txt` (metadata only; not SQL payload).

Layers **on top of** already-installed Phase 3B canonical reservation.  
Does **not** replay or replace the certified Phase 3B package files.

## Problem

Phase 3B `court_resource_daily_play_acquire` called:

```sql
court_resource_reserve_core(..., now(), now() + interval '12 hours', ...)
```

That is not Daily Play domain interval authority: the end is an arbitrary
clock horizon, and a later retry in a new transaction recomputes different
`startsAt`/`endsAt`, breaking stable normalized payload semantics.

## Domain audit (authoring)

| Authority | Finding |
| --------- | ------- |
| Existing scheduled `startsAt`+`endsAt` | **NO** — Daily Play is an open live session |
| Lease start | `daily_play_court_leases.leased_at` (assignment) |
| Match play start | match JSON `startedAt` (on `daily_play_start_match`) |
| Planned/session end | **NONE** — only post-facto `released_at` / `closedAt` |
| Venue | `venues.timezone` exists; Daily Play does not use competition operating windows |

`DAILY_PLAY_EXISTING_WINDOW_COMPLETE=NO` → **Option A unavailable**.

## Interval policy (Option B)

`INTERVAL_POLICY=PERSISTED_SESSION_CAPACITY_WINDOW`

`CAPACITY_END_DOMAIN_POLICY=VENUE_LOCAL_CIVIL_DAY_END_AT_FIRST_ACQUIRE`

1. First acquire for `(tenant, tournament, match, legacy court)` captures
   `capacity_starts_at` once (assignment / hold begin).
2. `capacity_ends_at` = next exclusive venue-local midnight after start
   (`venues.timezone`, fallback `UTC`). If fewer than 1 hour remains until that
   midnight, use the following midnight so a near-midnight assign still has a
   playable match hold.
3. Window is persisted in `public.daily_play_court_capacity_windows` and reused
   for all retries of the same hold key.
4. Canonical reservation uses those exact timestamps.
5. While the hold remains active and wall-clock approaches the end
   (`now() >= ends_at - 30 minutes`), extend by one venue-local day
   (window + active reservation), transactional and idempotent.

`LONG_RUNNING_SESSION_EXTENSION_REQUIRED=YES`  
`LONG_RUNNING_SESSION_EXTENSION_POLICY=ACTIVE_HOLD_EXTEND_ONE_VENUE_DAY_NEAR_EXPIRY`

## Atomicity

Cutover ON assign/change already run acquire + lease insert in one PostgreSQL
transaction. 4D acquire also upserts the capacity window in that same
transaction → interval + reservation + lease commit or roll back together.

## Cutover

Does **not** enable SQL or JS cutover. Defaults remain `false`.

## Package files

| File | Role |
| ---- | ---- |
| `01_PRECHECK.sql` | Read-only; Phase 3B present; SQL cutover false; acquire fingerprint |
| `02_APPLY.sql` | One transaction; capacity window + acquire/start_match touch |
| `03_VERIFY.sql` | Read-only proofs |
| `04_ROLLBACK.sql` | Restore pre-4D acquire/start_match; drop 4D objects; keep Phase 3B |

## Certified Phase 3B package (DO NOT MODIFY)

`docs/v5/migrations/court-resource-phase3b-canonical-reservation-01/{01,02,03,04}_*.sql`

SHA256 (authoring freeze):

| File | SHA256 |
| ---- | ------ |
| `01_PRECHECK.sql` | `528A482CC77EDEA38DC35B9A5323E00B82C4C25894D06B15A27B1E422FE8B13C` |
| `02_APPLY.sql` | `61418ABABBB6B12CF1E956822573154D7588D59C14B9D9603A867C464A87B032` |
| `03_VERIFY.sql` | `7766F80784EE0724626C7D7BF6C4EFF5185D7F1CC59C42F0113DC25400C18934` |
| `04_ROLLBACK.sql` | `43E39245D3698ED21565AE43C2322A64A474122E51730BAABA7B9A5AAC280898` |
