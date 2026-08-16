# 2.2 Court Operations — Court Resource ownership freeze

**Status:** Frozen for Batch 2 native physical identity + canonical gateway chain  
**Do not invert these owners without an Owner GO.**

```
COURT_RESOURCE_OWNER=2.2_COURT_OPERATIONS
COURT_RESOURCE_GATEWAY_OWNER=2.2_COURT_OPERATIONS
COURT_MASTER_OWNER=2.2_COURT_OPERATIONS
COURT_ACCESS_AUTHORITY_OWNER=2.2_COURT_OPERATIONS
COMPETITION_PROVIDER_BINDING_OWNER=2.2_COURT_OPERATIONS
```

## What 2.2 Court Operations owns

- `CourtResourceGateway`
- Court Resource services
- court cluster **topology** (`clusterId` is filter/scope, not reservable identity)
- canonical Physical Court identity (`physicalCourtId`)
- court inventory
- club → physical court **operational access**
- court eligibility
- court availability / capacity / reservation authority
- Competition Court Contract A **provider binding** (`courtResourceCompetitionAdapter`)
- Court Live Resource Runtime (later batches)

Canonical masters:

| Concern | Authority |
| ------- | --------- |
| Physical Court identity | `public.court_resource_physical_courts` |
| Cluster topology | `public.court_clusters` |
| Club operational access | `public.court_resource_club_operational_access` |
| Durable reservation / capacity | `public.court_resource_reservations` |

Canonical reservable identity is `physicalCourtId` / `physicalCourtIds`.

- `clusterId` = topology / filter only
- `courtCount` = demand only — not identity
- label / name / number = display only — not identity
- `courtId` / `selectedCourtIds` / `legacyCourtId` = compatibility only — not canonical identity

A Physical Court may be accessible to multiple clubs. That MUST NOT duplicate Physical Court rows.

`clubs.registered_cluster_id` is Club facility registration. It is **not** operational physical-court access.

Club blob possession of a court (`club_data_v3` / localStorage) is **not** access proof.

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

Venue & Court `listCourts` / `club_data_v3` remain **transitional compatibility** readers for old noncanonical consumers. They are not the target inventory or access authority.
