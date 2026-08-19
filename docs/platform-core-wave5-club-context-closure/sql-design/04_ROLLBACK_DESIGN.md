# Wave 5 Club Tenant migration — rollback design

```
WAVE5_SQL_DESIGN_ONLY
OWNER_SQL_EXECUTION_GO=NO
DO_NOT_RUN_ON_STAGING
DO_NOT_RUN_ON_PRODUCTION
```

Do **not** execute rollback from this document.

APPLY is a single `BEGIN`…`COMMIT` with no internal `COMMIT`. If any statement fails after trigger disable or FK drop, the whole transaction rolls back (`PARTIAL_CUTOVER_COMMIT_POSSIBLE=NO`). That is abort/retry of the design package, not a data rollback after a successful canonical cutover.

## APP_ROLLBACK_KEEP_CANONICAL_DB (preferred)

Once canonical SQL is eventually applied, reverse the **application** to a build that still understands both RPC shapes:

- Marker / `canonical_tenant_id` present → use canonical Tenant
- Old shape → translate legacy Venue scope via Venue

The database can remain canonical for:

- `clubs.tenant_id`
- `club_members.tenant_id`
- `club_governance_assignments.tenant_id`
- `club_membership_requests_v42.tenant_id`

This is the only generally safe rollback after Tenant 1:N Venue.

## DB rollback — not generally safe

Post-migration Club-owned `tenant_id` values are Platform Tenant IDs. Restoring the legacy Venue ID requires a deterministic Club → Venue map for **every** migrated table.

That map is **not** recoverable from canonical `tenant_id` alone after Tenant 1:N Venue.

A DB rollback may only be described as possible while **all** of these remain true:

1. Pre-migration mapping (`club_id`, `legacy_venue_scope_id`, `canonical_tenant_id`) was captured and retained for clubs **and** proven to cover members, governance assignments, and membership requests via `club_id`.
2. Every Club still maps to exactly one Venue (deterministic).
3. No new Clubs were created under a Tenant with multiple Venues.
4. Owner issues an explicit DB rollback GO naming each table.

Do **not** claim that canonical Tenant → legacy Venue rollback is deterministic under Tenant 1:N Venue.

There is no executable reverse-translation script in this package. No rollback is executed by this design.

## Helper / RLS

`platform_is_canonical_tenant_entitled` is additive. Global `phase42_is_tenant_member` is **not** dropped by Wave 5. Rolling back Club RLS/helpers to the legacy helper is a separate Owner decision and would re-introduce Venue-as-Tenant Club authorization.

Athlete compatibility wrappers (`wave5_resolve_club_facility_venue_id`, `wave5_ensure_athlete_for_club_member`) are additive. Athletes themselves are not migrated.

## Fail-closed while Q1 quiesced

If Q1 committed and APPLY aborted, mutation EXECUTE stays revoked. Do not auto-retry APPLY. Owner-elected return to legacy privileges uses `07C_RESTORE_WRITES_DESIGN.sql` (exact snapshot replay only). Do not `GRANT EXECUTE TO authenticated` as a generic set.

Successful APPLY + body VERIFY uses `07D_RESTORE_INTENDED_WRITES_DESIGN.sql` for the intended public command surface. Internal helpers remain `authenticated EXECUTE = DENIED`.

## Direct `clubs.venue_id`

Not added. Nothing to drop on rollback.
