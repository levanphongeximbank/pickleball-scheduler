# 2.2 Court Operations — Court Resource ownership freeze

**Status:** Frozen for Batch 4 canonical Resource Block business lifecycle  
**Do not invert these owners without an Owner GO.**

```
COURT_RESOURCE_OWNER=2.2_COURT_OPERATIONS
COURT_RESOURCE_GATEWAY_OWNER=2.2_COURT_OPERATIONS
COURT_MASTER_OWNER=2.2_COURT_OPERATIONS
COURT_ACCESS_AUTHORITY_OWNER=2.2_COURT_OPERATIONS
COMPETITION_PROVIDER_BINDING_OWNER=2.2_COURT_OPERATIONS
BOOKING_BUSINESS_OWNER=2.2_COURT_OPERATIONS
RESOURCE_BLOCK_BUSINESS_OWNER=2.2_COURT_OPERATIONS
```

## What 2.2 Court Operations owns

- `CourtResourceGateway`
- Court Resource services
- Court Operations Booking Application (`courtOperationsBookingApplication`)
- Court Operations Resource Block Application (`courtOperationsResourceBlockApplication`)
- court cluster **topology** (`clusterId` is filter/scope, not reservable identity)
- canonical Physical Court identity (`physicalCourtId`)
- court inventory
- club → physical court **operational access**
- court eligibility
- court availability / capacity / reservation authority
- canonical Booking business aggregate (`court_operations_bookings`)
- canonical Resource Block business aggregate (`court_operations_resource_blocks`)
- Competition Court Contract A **provider binding** (`courtResourceCompetitionAdapter`)
- Court Live Resource Runtime (later batches)

Canonical masters:

| Concern | Authority |
| ------- | --------- |
| Physical Court identity | `public.court_resource_physical_courts` |
| Cluster topology | `public.court_clusters` |
| Club operational access | `public.court_resource_club_operational_access` |
| Durable reservation / capacity | `public.court_resource_reservations` |
| Booking business aggregate | `public.court_operations_bookings` |
| Resource block business aggregate | `public.court_operations_resource_blocks` |

**Separation:** Booking business SSOT is **not** the reservation SSOT.
Resource Block business SSOT is also **not** the reservation SSOT.
Reservation rows are capacity pointers:

- Booking: `owner_type='booking'`, `owner_id=bookingId`
- Resource Block MAINTENANCE: `owner_type='maintenance'`, `owner_id=resourceBlockId`,
  `owner_sub_type='resource_block'`
- Resource Block OPERATIONAL_BLOCK: `owner_type='operations'`, `owner_id=resourceBlockId`,
  `owner_sub_type='resource_block'`

Do **not** invent a `court_resource_block` owner type. Resource Blocks must not
create `bookingType=maintenance` and must not treat `court.status` as capacity.

Canonical reservable / booking court identity is `physicalCourtId` / `physicalCourtIds`.

- `clusterId` = topology / filter only
- `courtCount` = demand only — not identity
- label / name / number = display only — not identity
- `courtId` / `selectedCourtIds` / `legacyCourtId` = compatibility only — not canonical identity

A Physical Court may be accessible to multiple clubs. That MUST NOT duplicate Physical Court rows.

`clubs.registered_cluster_id` is Club facility registration. It is **not** operational physical-court access.

Club blob possession of a court (`club_data_v3` / localStorage) is **not** access proof.
`club_data_v3.bookings[]` is **not** canonical Booking business authority on the canonical path.

Club Management does not own court access.  
Venue Management does not own Physical Court identity.

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

## Adjacent owners (not Court Resource)

| Owner | Owns | Does not own |
| ----- | ---- | ------------ |
| 2.1 Venue Management | venue identity / lifecycle | Physical Court identity, court inventory, capacity |
| Platform canonical organization | tenant / organization identity | court access |
| 2.3 Club Management | club identity / lifecycle / membership | court access, Physical Court identity |
| Customer Management | customer master | booking business aggregate |
| Finance | payment ledger | booking price metadata projections |

Venue & Court `listCourts` / `club_data_v3` remain **transitional compatibility** readers for old noncanonical consumers. They are not the target inventory, access, Booking, or Resource Block business authority.

## Deferred

```
DAILY_PLAY_CANONICAL_BUSINESS_AGGREGATE=DEFERRED
DAILY_PLAY_RUNTIME_RESOURCE_BLOCK_CERTIFICATION_DEFERRED=YES
LIVE_RESOURCE_RUNTIME_REDESIGN_DEFERRED=YES
```

Daily Play remains capacity-owner vocabulary (`daily_play`) under Phase 3B / D4.
A Daily Play business aggregate (Batch-style) is **not** started in Batch 4.
Whole-system Daily Play runtime Resource Block certification is deferred until
caller adoption reaches the native identity/capacity path. Court Live Resource
Runtime redesign remains deferred (Batch 7+).

```
CANONICAL_BOOKING_LIFECYCLE_DEFAULT=false
CANONICAL_RESOURCE_BLOCKS_DEFAULT=false
SQL_CUTOVER=false
JS_CUTOVER=false
DUAL_CUTOVER=OFF_OFF
```
