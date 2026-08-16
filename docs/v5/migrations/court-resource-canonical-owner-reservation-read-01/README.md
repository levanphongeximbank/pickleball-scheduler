# Court Resource — Canonical owner-reservation read 01

**AUTHORED LOCALLY ONLY. NOT APPLIED TO STAGING OR PRODUCTION.**

```
STAGING_APPLY=NO
PRODUCTION_APPLY=NO
```

## Migration identity

```
OWNER_RESERVATION_READ_MIGRATION_VERSION=20260816140000
OWNER_RESERVATION_READ_MIGRATION_NAME=court_resource_canonical_owner_reservation_read_01
```

Machine-readable copy: `MIGRATION_IDENTITY.txt`.

This package is **additive** and separate from Phase 3A / Phase 3B / D4.
It does **not** edit certified Phase 3A, Phase 3B, or D4 SQL.

## Why a new RPC

Phase 3B created `public.court_resource_reservations` with RLS SELECT and
**no** authenticated/anon table grants. Existing RPCs are reserve / release /
availability. There is no Court Operations-owned owner-scoped list RPC.

Direct table SELECT is forbidden. This package adds that secure read path.

## RPC

`public.court_resource_list_owner_reservations(p_tenant_id, p_club_id, p_owner_type, p_owner_id, p_physical_court_ids)`

Semantics:

- authenticated (`auth.uid()` required)
- tenant-scoped (`is_super_admin()` or `p_tenant_id = user_venue_id()`)
- club must belong to the tenant (`public.clubs`)
- owner-scoped (`owner_type` + `owner_id`)
- optional `physicalCourtIds` filter; unknown/cross-tenant UUID fails closed
- active reservations only
- native `physicalCourtId` output
- fail closed

`SECURITY DEFINER` is required because package tables have no client grants.
`search_path` is pinned. No broad table grants.

## Package files

Run order after explicit Owner GO (not this batch): `01_PRECHECK.sql`,
`02_APPLY.sql`, `03_VERIFY.sql`. `04_ROLLBACK.sql` drops only this RPC.

## Cutover

Does **not** enable SQL or JS reservation cutover. Defaults remain `false`.
