# 2.2 Court Operations — Court Resource ownership freeze

**Status:** Frozen for Batch 8 legacy isolation + cluster semantic closure  
**Do not invert these owners without an Owner GO.**

```
COURT_RESOURCE_OWNER=2.2_COURT_OPERATIONS
COURT_RESOURCE_GATEWAY_OWNER=2.2_COURT_OPERATIONS
COURT_MASTER_OWNER=2.2_COURT_OPERATIONS
COURT_ACCESS_AUTHORITY_OWNER=2.2_COURT_OPERATIONS
COMPETITION_PROVIDER_BINDING_OWNER=2.2_COURT_OPERATIONS
BOOKING_BUSINESS_OWNER=2.2_COURT_OPERATIONS
RESOURCE_BLOCK_BUSINESS_OWNER=2.2_COURT_OPERATIONS
COURT_LIVE_RESOURCE_RUNTIME_OWNER=2.2_COURT_OPERATIONS
```

## Distinct identity owners (Batch 5)

```
TENANT_ID_OWNER=PLATFORM_CANONICAL_ORGANIZATION
VENUE_ID_OWNER=2.1_VENUE_MANAGEMENT
CLUB_ID_OWNER=2.3_CLUB_MANAGEMENT
CLUSTER_ID_OWNER=2.2_COURT_OPERATIONS
PHYSICAL_COURT_ID_OWNER=2.2_COURT_OPERATIONS
CLUB_OPERATIONAL_COURT_ACCESS_OWNER=2.2_COURT_OPERATIONS
```

```
TENANT_ID_EQUALS_VENUE_ID_ASSUMPTION=NO
COURT_CLUSTERS_VENUE_ID_SEMANTICS=canonical_venue_id
COURT_CLUSTERS_TENANT_ID_SEMANTICS=platform_tenant_id
COURT_CLUSTERS_TENANT_SEMANTICS_EXPLICIT=YES
COURT_CLUSTERS_VENUE_SEMANTICS_EXPLICIT=YES
COURT_CLUSTERS_VENUE_ID_ORG_PARENT_DEBT_ON_CANONICAL_PATH=NO
D4_VENUE_BOUNDARY_STATUS=COUPLED_TO_VENUES_AS_TENANT_OFF_PATH_ONLY
LEGACY_COMPATIBILITY_BOUNDARY_EXPLICIT=YES
LEGACY_BOUNDARY_LOCATION=src/features/court-resource/legacy/
NEW_SQL_REQUIRED=YES
NEW_DUPLICATE_IDENTITY_CONTRACTS_CREATED=NO
```

Court Operations API treats `tenantId` and `venueId` as **distinct concepts**.
Product history may still store the same opaque string in both places; Court Ops
must not collapse them (`tenantId || venueId` invent is forbidden on canonical
paths).

`court_clusters.tenant_id` is explicit Platform/org tenant scope.
`court_clusters.venue_id` is explicit 2.1 Venue Management identity.
Canonical inventory never treats `venue_id` as organization-parent invent
(`COURT_CLUSTERS_VENUE_ID_ORG_PARENT_DEBT_ON_CANONICAL_PATH=NO`). Additive SQL:
`docs/v5/migrations/court-operations-legacy-isolation-01/` (authored, not applied).

D4 venue-as-tenant coupling remains OFF-path only and is not used by canonical
Daily Play Adapter B.

ClubContext / active club selection is **UI selection only** — not Court
Operations identity or access authority.

## What 2.2 Court Operations owns

- `CourtResourceGateway`
- Court Resource services
- Court Operations scope normalizer (`courtOperationsScope`)
- Court Operations Booking Application (`courtOperationsBookingApplication`)
- Court Operations Resource Block Application (`courtOperationsResourceBlockApplication`)
- Court Operations Live Resource Runtime (`courtOperationsLiveRuntimeApplication`)
- court cluster **topology** (`clusterId` is filter/scope, not reservable identity)
- canonical Physical Court identity (`physicalCourtId`)
- court inventory
- club → physical court **operational access**
- court eligibility
- court availability / capacity / reservation authority
- canonical Booking business aggregate (`court_operations_bookings`)
- canonical Resource Block business aggregate (`court_operations_resource_blocks`)
- canonical Court Live State + Resource Session (`court_operations_court_live_states`,
  `court_operations_resource_sessions`)
- Competition Court Contract A **provider binding** (`courtResourceCompetitionAdapter`)

Canonical masters:

| Concern | Authority |
| ------- | --------- |
| Physical Court identity | `public.court_resource_physical_courts` |
| Cluster topology | `public.court_clusters` |
| Club operational access | `public.court_resource_club_operational_access` |
| Durable reservation / capacity | `public.court_resource_reservations` |
| Booking business aggregate | `public.court_operations_bookings` |
| Resource block business aggregate | `public.court_operations_resource_blocks` |
| Current occupancy / live session / NOW operational state | `public.court_operations_court_live_states` + `public.court_operations_resource_sessions` |

**Three authorities must remain distinct:**

1. Capacity SSOT = `court_resource_reservations` (durable/future windows)
2. Resource Block business SSOT = `court_operations_resource_blocks` (why capacity is blocked)
3. Live Resource Runtime = occupancy + active session + current operational state (NOW)

```
COURT_LIVE_RUNTIME_IS_RESERVATION_SSOT=NO
LIVE_OCCUPANCY_USED_AS_RESERVATION_CONFLICT_AUTHORITY=NO
LIVE_RUNTIME_MATCH_LIFECYCLE_AUTHORITY=NO
LIVE_RUNTIME_SCORING_AUTHORITY=NO
COMPETITION_MATCH_ASSIGNMENT_OWNER=2.13_COMPETITION_ENGINE
```

Live Runtime MUST NOT insert/delete `court_resource_reservations` when occupancy
starts/ends. Starting a live session does NOT create capacity. Ending a live
session does NOT release capacity.

Current operational state is NOW-only (`AVAILABLE` / `UNAVAILABLE_NOW` /
`OUT_OF_SERVICE_NOW`). It is NOT an infinite future reservation. Future durable
closure requires a Resource Block with `startsAt`/`endsAt`.

**Separation:** Booking business SSOT is **not** the reservation SSOT.
Resource Block business SSOT is also **not** the reservation SSOT.
Live Runtime is **not** the reservation SSOT.
Reservation rows are capacity pointers:

- Booking: `owner_type='booking'`, `owner_id=bookingId`
- Resource Block MAINTENANCE: `owner_type='maintenance'`, `owner_id=resourceBlockId`,
  `owner_sub_type='resource_block'`
- Resource Block OPERATIONAL_BLOCK: `owner_type='operations'`, `owner_id=resourceBlockId`,
  `owner_sub_type='resource_block'`

Do **not** invent a `court_resource_block` owner type. Resource Blocks must not
create `bookingType=maintenance` and must not treat `court.status` as capacity.

Canonical reservable / booking / live court identity is `physicalCourtId` / `physicalCourtIds`.

- `clusterId` = topology / filter only
- `courtCount` = demand only — not identity
- label / name / number = display only — not identity
- `courtId` / `selectedCourtIds` / `legacyCourtId` = compatibility only — not canonical identity

A Physical Court may be accessible to multiple clubs. That MUST NOT duplicate Physical Court rows.

`clubs.registered_cluster_id` is Club facility registration. It is **not** operational physical-court access.

Club blob possession of a court (`club_data_v3` / localStorage) is **not** access proof.
`club_data_v3.bookings[]` is **not** canonical Booking business authority on the canonical path.
`club_data_v3` `court.status` is **not** canonical current operational state on the canonical path.

Club Management does not own court access.  
Venue Management does not own Physical Court identity.

## Court Engine responsibility matrix

| Concern | Owner |
| ------- | ----- |
| physicalCourt identity | 2.2 Court Operations |
| capacity reservation | 2.2 Court Operations |
| current occupancy | 2.2 Court Operations |
| active resource session | 2.2 Court Operations |
| current operational state | 2.2 Court Operations |
| match assignment business record | 2.13 Competition Engine |
| match lifecycle | 2.13 Competition Engine |
| score | 2.13 Competition Engine |
| winner/result | 2.13 Competition Engine |
| referee competition logic | 2.13 Competition Engine |

## Provider binding location

`courtResourceCompetitionAdapter` is owned by 2.2 Court Operations.

Physical file remains:

`src/features/competition-core/adapters/courtResourceCompetitionAdapter.js`

because Competition Court Contract A V1 freezes that import path, and moving the
implementation under `src/features/court-resource/` would import Head A from
Court Resource (forbidden reverse dependency).

```
PROVIDER_PHYSICAL_RELOCATION_DEFERRED=YES
```

One provider implementation only. Native identity handoff is
`physicalCourtId` / `physicalCourtIds` with no remap to legacy Gateway fields.
Competition Contract A scope passes `tenantId` unchanged — never invents
`venueId` from `tenantId`.

## Competition live integration (Batch 7)

```
COMPETITION_LIVE_INTEGRATION_MODEL=GENERIC_LIVE_RESOURCE_USE_PROJECTION_ONE_WAY
```

Competition owns match lifecycle. Court Live Runtime consumes only a generic
resource-use projection (`sourceType=competition`, opaque `sourceId=matchId`).
Court Operations never calls back into Competition business logic.
Head A V1 is unchanged and remains capacity-only (Adapter B → Head A).
No direct Gateway bypass.

## Adjacent owners (not Court Resource)

| Owner | Owns | Does not own |
| ----- | ---- | ------------ |
| 2.1 Venue Management | venue identity / lifecycle | Physical Court identity, court inventory, capacity |
| Platform canonical organization | tenant / organization identity | court access |
| 2.3 Club Management | club identity / lifecycle / membership | court access, Physical Court identity |
| Customer Management | customer master | booking business aggregate |
| Finance | payment ledger | booking price metadata projections |
| 2.13 Competition Engine | match lifecycle / score / winner / bracket | live occupancy SSOT |

Venue & Court `listCourts` / `club_data_v3` remain **transitional compatibility** readers for old noncanonical consumers. They are not the target inventory, access, Booking, Resource Block, or Live Runtime authority.

Reused (not duplicated) framing contracts: CourtOperationsTenantContract /
CourtOperationsClubContract / VenueContractV2 projections via existing
`projectTenantScope`, `projectVenueCourt*`, `projectClubScope` adapters.

## Deferred / Batch 8 legacy isolation

```
DAILY_PLAY_CANONICAL_BUSINESS_AGGREGATE=DEFERRED
DAILY_PLAY_RUNTIME_RESOURCE_BLOCK_CERTIFICATION_DEFERRED=YES
LIVE_RESOURCE_RUNTIME_REDESIGN_DEFERRED=NO
COURT_ENGINE_LIVE_RUNTIME_DEBT=legacy_path_isolated_batch8
LEGACY_COMPATIBILITY_BOUNDARY_EXPLICIT=YES
```

Legacy items retained behind `src/features/court-resource/legacy/` (not deleted):

| Item | Classification |
| ---- | -------------- |
| `court.status` blob | LEGACY_COMPATIBILITY_ONLY |
| tournament `currentMatchId` | UI_PROJECTION_ONLY / LEGACY_COMPATIBILITY_ONLY |
| Daily Play lease projection | LEGACY_COMPATIBILITY + PROJECTION (not capacity SSOT) |
| Court Engine session blob occupancy | LEGACY_COMPATIBILITY (not auto-promoted) |
| Gateway blob substrate | EXPLICIT_LEGACY_RUNTIME (OFF path only) |
| D4 acquire SQL | EXPLICIT_LEGACY_RUNTIME (certified, unchanged) |

See `legacy/LEGACY_RETIREMENT_MANIFEST.md`.

Daily Play remains capacity-owner vocabulary (`daily_play`) under Phase 3B / D4
on the **legacy** path. Batch 6 Mode Adapter B (canonical, default OFF) reserves
capacity only via Head A → `court_resource_reservations`; Daily Play lease is a
projection (`DAILY_PLAY_LEASE_IS_CAPACITY_SSOT=NO`). D4 certified SQL is unchanged.
`CANONICAL_DAILY_PLAY_CALLS_D4_LEGACY_CAPACITY_PATH=0`.

Mode Court Adapter B owner = `2.13_COMPETITION_ENGINE`  
(`src/features/competition-engine/integration/court-adapters/`).

```
CANONICAL_BOOKING_LIFECYCLE_DEFAULT=false
CANONICAL_RESOURCE_BLOCKS_DEFAULT=false
CANONICAL_COMPETITION_COURT_ADAPTERS_DEFAULT=false
CANONICAL_COURT_LIVE_RUNTIME_DEFAULT=false
SQL_CUTOVER=false
JS_CUTOVER=false
DUAL_CUTOVER=OFF_OFF
```
