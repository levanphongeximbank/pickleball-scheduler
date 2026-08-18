# Wave 5 Club Tenant migration — rollback design

```
WAVE5_SQL_DESIGN_ONLY
OWNER_SQL_EXECUTION_GO=NO
DO_NOT_RUN_ON_STAGING
DO_NOT_RUN_ON_PRODUCTION
```

Do **not** execute rollback from this document.

## APP_ROLLBACK_KEEP_CANONICAL_DB (preferred)

Once canonical SQL is eventually applied, reverse the **application** to a build that still understands both RPC shapes:

- Marker / `canonical_tenant_id` present → use canonical Tenant
- Old shape → translate legacy Venue scope via Venue

The database can remain canonical. This is the only generally safe rollback after Tenant 1:N Venue.

## DB rollback — not generally safe

Post-migration `clubs.tenant_id` is a Platform Tenant ID. Restoring the legacy Venue ID requires a deterministic Club → Venue map.

That map is **not** recoverable from `clubs.tenant_id` alone after Tenant 1:N Venue.

DB rollback is only conceivable if **all** of these remain true:

1. Pre-migration mapping (`club_id`, `legacy_venue_scope_id`, `canonical_tenant_id`) was captured and retained.
2. Every Club still maps to exactly one Venue (deterministic).
3. No new Clubs were created under a Tenant with multiple Venues.
4. Owner issues an explicit DB rollback GO.

Do **not** claim automatic DB rollback if a Tenant has multiple Venues.

There is no executable reverse-translation script in this package.

## Helper / RLS

`platform_is_canonical_tenant_entitled` is additive. Global `phase42_is_tenant_member` is **not** dropped by Wave 5. Rolling back Club RLS to the legacy helper is a separate Owner decision and would re-introduce Venue-as-Tenant Club authorization.

## Direct `clubs.venue_id`

Not added. Nothing to drop on rollback.
