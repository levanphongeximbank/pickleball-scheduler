# Court Resource Phase 3A — Physical identity foundation

Phase 3A Option B introduces a facility-level identity model without changing
reservation or runtime authorities.

## Identity and access

- `physicalCourtId` is an immutable UUID. Labels, numbers, Club IDs and source
  IDs are mutable/non-authoritative attributes.
- Every physical court belongs to one tenant and one durable
  `public.court_clusters.id`. Synthetic cluster values are never accepted as
  durable evidence.
- Unstamped / missing legacy `clusterId` classifies as `unresolved_cluster`.
  Do not silently assign a cluster. Conflicting durable evidence is
  `ambiguous`. Incomplete tenant/source provenance is `invalid_scope`.
- Club operational access is a separate many-to-many relation. Mapping
  `classification` (`deterministic`, `ambiguous`, and so on) never implies that access
  is enabled. `clubs.registered_cluster_id` is Club facility registration and
  is not `court_resource_club_operational_access`.
- Runtime eligibility (Batch 1) reads Court Master + Access Authority:
  `tenantId + clubId + optional clusterId` → active physical courts with
  **enabled** operational access. `CourtResourceGateway.listEligibleCourts`
  uses that path and must not fall back to `club_data_v3` / localStorage.
- A legacy court mapping key is exactly `(tenantId, clubId, sourceSystem,
  sourceVersion, legacyClusterId, legacyCourtId)`. Provenance is mandatory; no
  `legacy` or `unversioned` fallback is permitted.
- Equivalent duplicate mapping records are idempotent. Conflicting records,
  cross-tenant records, unresolved clusters, and incomplete provenance fail
  closed.

## SQL shape parity

JavaScript camel-case fields map directly to SQL snake-case fields:

- `physicalCourtId` → `physical_court_id`
- `tenantId` → `tenant_id`
- `clubId` → `club_id`
- `sourceSystem` → `source_system`
- `sourceVersion` → `source_version`
- `legacyClusterId` → `legacy_cluster_id`
- `legacyCourtId` → `legacy_court_id`
- JS `classification` → SQL `classification`
- operational `status` remains independent from mapping `classification`

The local package is under
`docs/v5/migrations/court-resource-post427-canonical-reconciliation-01`.
It is authored only: no remote SQL was applied.

## Deferred

Reservation tables, runtime gateway integration, venue-court integration,
tournament booking, Daily Play, Team Tournament, and Court Engine cutover were
outside Phase 3A. Phase 3B authors `public.court_resource_reservations` as the
canonical durable capacity authority. Runtime cutover remains **OFF**
(`CANONICAL_RESERVATION_CUTOVER=false`) until a separate Owner GO.
