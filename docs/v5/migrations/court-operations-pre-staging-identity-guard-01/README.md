# Court Operations — Pre-Staging Identity Guard 01

**AUTHORED LOCALLY ONLY. NOT APPLIED TO STAGING OR PRODUCTION.**

```
STAGING_APPLY=NO
PRODUCTION_APPLY=NO
IDENTITY_GUARD_CORRECTION_MIGRATION_VERSION=20260816190000
```

## Purpose

Close Phase 3A `court_resource_identity_guard()` semantic debt that compared
`court_resource_physical_courts.tenant_id` to `court_clusters.venue_id`.

That comparison was valid only under historical overloaded venues-as-tenant
semantics. After Batch 8:

| Column | Semantics |
| ------ | --------- |
| `court_clusters.tenant_id` | Platform/org tenant scope |
| `court_clusters.venue_id` | 2.1 Venue Management identity |

Therefore **tenant_id must NOT be validated against venue_id**.

## Target guard semantics

1. Cluster exists (unknown cluster fail-closed)
2. `cluster.tenant_id` is present
3. `physicalCourt.tenant_id = cluster.tenant_id`
4. `cluster.venue_id` remains Venue context (not compared as tenant)
5. `tenantId` and `venueId` remain distinct concepts
6. Foreign tenant fails closed
7. Using `venueId` as `tenantId` fails closed

## Object

| Field | Value |
| ----- | ----- |
| OBJECT_NAME | `public.court_resource_identity_guard()` |
| OBJECT_TYPE | TRIGGER FUNCTION (BEFORE INSERT/UPDATE) |
| CURRENT_TRIGGER_BINDING | `trg_court_resource_physical_courts_guard`, `trg_court_resource_club_access_guard`, `trg_court_resource_cluster_mapping_guard`, `trg_court_resource_legacy_mapping_guard` |

This package uses `CREATE OR REPLACE FUNCTION` only. It does **not** edit the
certified Phase 3A package files. Triggers are left bound to the same function
name (no trigger recreation required).

## Dependency order (Staging plan — not applied here)

```
Phase3A  court-resource-post427-canonical-reconciliation-01
  → Phase3B  court-resource-phase3b-canonical-reservation-01
  → D4       court-resource-phase3b-daily-play-interval-authority-01
  → Batch1   court-resource-canonical-inventory-read-01
  → Batch2   court-resource-canonical-owner-reservation-read-01
  → Batch3   court-resource-canonical-booking-lifecycle-01
  → Batch4   court-resource-canonical-resource-blocks-01
  → Batch7   court-operations-live-resource-runtime-01
  → Batch8   court-operations-legacy-isolation-01   (cluster tenant_id column)
  → THIS     court-operations-pre-staging-identity-guard-01
```

Hard prerequisites for this package: Phase3A function exists + Batch8
`court_clusters.tenant_id` column is NOT NULL.

## ROLLBACK_DEPENDENCY

```
ROLLBACK_DEPENDENCY=
  Restoring Phase3A venue_id comparison WHILE keeping Batch8 distinct
  tenant_id / venue_id semantics leaves an INVALID guard
  (valid physical courts with tenant_id != venue_id would be rejected).

  Honest rollback paths:
  1. Roll back THIS package AND immediately roll back Batch8
     (collapse tenant invent to venue_id again), OR
  2. Do not roll back THIS package in isolation after Batch8 is live.

  Independent rollback of this package while Batch8 remains applied
  is NOT safe.
```

## Safety

- Additive `CREATE OR REPLACE` only
- No Phase 3A / 3B / D4 / Batch1–8 certified SQL file edits
- No Staging / Production apply in this gate
- No destructive table rewrite
- No broad grants
