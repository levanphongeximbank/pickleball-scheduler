# Court Operations — Legacy isolation 01

**AUTHORED LOCALLY ONLY. NOT APPLIED TO STAGING OR PRODUCTION.**

```
STAGING_APPLY=NO
PRODUCTION_APPLY=NO
LEGACY_ISOLATION_MIGRATION_VERSION=20260816220000
```

## Purpose

Close `court_clusters.venue_id` organization-parent semantic debt on the
canonical path without renaming/dropping `venue_id` and without rewriting
Phase 3A / 3B / D4 certified package files.

| Column | Semantics after apply |
| ------ | --------------------- |
| `tenant_id` | Platform/org tenant scope (explicit, NOT NULL) |
| `venue_id` | 2.1 Venue Management identity (explicit, retained FK) |

## Backfill

```
tenant_id := venue_id
WHERE venues.id = court_clusters.venue_id
```

Provable because `venue_id` already FKs to `venues`. Unresolved rows fail closed.

Historical product stored org scope in `venue_id` (venues-as-tenant). This package
makes the two concepts **explicit columns**. Canonical API still forbids
`tenantId || venueId` invent (`TENANT_ID_EQUALS_VENUE_ID_ASSUMPTION=NO`).

## Inventory RPC

`CREATE OR REPLACE public.court_resource_list_eligible_courts` filters optional
cluster scope by `cc.tenant_id` (not `cc.venue_id` as tenant invent).

## Safety

- Additive column + indexes
- No Phase 3A/3B/D4 file edits (`CERTIFIED_SQL_CHANGED_COUNT=0`)
- No Staging/Production apply in Batch 8
- Rollback restores pre-Batch8 inventory body and drops `tenant_id`
