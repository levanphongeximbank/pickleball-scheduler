# Court Resource — Canonical inventory read 01

**AUTHORED LOCALLY ONLY. NOT APPLIED TO STAGING OR PRODUCTION.**

```
STAGING_APPLY=NO
PRODUCTION_APPLY=NO
```

## Migration identity

```
INVENTORY_READ_MIGRATION_VERSION=20260816121400
INVENTORY_READ_MIGRATION_NAME=court_resource_canonical_inventory_read_01
```

Machine-readable copy: `MIGRATION_IDENTITY.txt`.

This package is **additive** and separate from Phase 3A / Phase 3B / D4.
It does **not** edit certified Phase 3A, Phase 3B, or D4 SQL.

## Why a new RPC

Phase 3A created:

- `public.court_resource_physical_courts`
- `public.court_resource_club_operational_access`
- RLS SELECT policies with **no** authenticated/anon table grants

There is no existing Court Operations-owned read RPC that returns eligible
physical courts for `tenantId + clubId + optional clusterId`. Direct table
SELECT is forbidden. This package adds that secure read path.

## RPC

`public.court_resource_list_eligible_courts(p_tenant_id, p_club_id, p_cluster_id)`

Semantics:

- authenticated (`auth.uid()` required)
- tenant-scoped (`is_super_admin()` or `p_tenant_id = user_venue_id()`)
- club must belong to the tenant (`public.clubs`)
- optional `clusterId` must belong to the tenant (`public.court_clusters`) — filter only
- join enabled `court_resource_club_operational_access`
- active `court_resource_physical_courts` only
- fail closed

Returns native `physicalCourtId`. Cluster is never listed as a fake court.

`SECURITY DEFINER` is required because package tables have no client grants.
`search_path` is pinned. No broad table grants.

## Package files

Run order after explicit Owner GO (not this batch): `01_PRECHECK.sql`,
`02_APPLY.sql`, `03_VERIFY.sql`. `04_ROLLBACK.sql` drops only this RPC.

## Cutover

Does **not** enable SQL or JS reservation cutover. Defaults remain `false`.
