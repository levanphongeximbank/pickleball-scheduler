# Court resource post-427 canonical reconciliation — Phase 3A Option B

**AUTHORED LOCALLY ONLY. NOT APPLIED TO STAGING OR PRODUCTION.**

Run order after explicit owner approval: `01_PRECHECK.sql`, `02_APPLY.sql`,
`03_VERIFY.sql`. `04_ROLLBACK.sql` is destructive to package-owned data.

## Scope

This package adds physical-court UUID authority, durable
`public.court_clusters` parentage, many-to-many Club operational access,
versioned/provenance legacy mappings, and fail-closed RLS. It does not add or
alter reservations, pilots, gateway/runtime consumers, or legacy blobs.

The legacy mapping key is `(tenant_id, club_id, source_system, source_version,
legacy_cluster_id, legacy_court_id)`. Every component is mandatory.
Classification is independent from Club operational access status.

This package does not require `public.bind_club_courts_to_cluster` to already
exist. Unstamped legacy courts classify fail-closed (`unresolved_cluster` or
review) instead of being silently mutated. Keep this package separate from
`docs/v5/migrations/venue-court-canonical-cluster-binding-01`.

## Complete ownership manifest

Package-owned tables:

- `court_resource_physical_courts`
- `court_resource_club_operational_access`
- `court_resource_cluster_identity_mappings`
- `court_resource_legacy_court_identity_mappings`

Package-owned functions:

- `court_resource_identity_guard()`
- `court_resource_resolve_legacy_court_mapping(text,text,text,text,text,text,text,uuid,jsonb,jsonb)`

Package-owned triggers:

- `trg_court_resource_physical_courts_guard`
- `trg_court_resource_club_access_guard`
- `trg_court_resource_cluster_mapping_guard`
- `trg_court_resource_legacy_mapping_guard`

Package-owned policies:

- `court_resource_physical_courts_select`
- `court_resource_club_access_select`
- `court_resource_cluster_mappings_select`
- `court_resource_legacy_mappings_select`

Package-owned indexes (in addition to table primary/unique constraint indexes):

- `court_resource_physical_courts_cluster_idx`
- `court_resource_club_access_club_idx`
- `court_resource_club_access_court_idx`
- `court_resource_cluster_mapping_target_idx`
- `court_resource_legacy_mapping_court_idx`
- `court_resource_legacy_mapping_review_idx`

Every primary-key, foreign-key, check, and unique constraint declared by
`02_APPLY.sql` is package-owned because it is attached only to one of the four
package-owned tables. This includes PostgreSQL-generated names for inline
column constraints. No constraint, index, policy, trigger, or function is
added to an existing table. Rollback drops only the objects listed above
(table-owned constraints/indexes disappear with their package table).
