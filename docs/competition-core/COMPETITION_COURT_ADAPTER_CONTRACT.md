# Competition Court Adapter Contract — Tournament ĐẦU B Handoff

**Status:** ĐẦU A locked for consumers (V1)  
**Owner:** Competition Core / shared court architecture  
**Consumers:** Internal Tournament, Official/Open Tournament, Team Tournament, future Competition modes

## CONTRACT_NAME

`Competition Court Adapter Contract`

---

## CONTRACT_VERSION

`1`

Constant: `COMPETITION_COURT_ADAPTER_CONTRACT_VERSION`

---

## AUTHORITATIVE_IMPORT_PATH

```text
src/features/competition-core/contracts/competitionCourtAdapterContract.js
```

---

## BINDING_IMPORT_PATH

```text
src/features/competition-core/adapters/courtResourceCompetitionAdapter.js
```

Recommended usage:

```javascript
import {
  COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
  COMPETITION_COURT_ADAPTER_CAPABILITY,
  COMPETITION_COURT_RESULT_CODE,
  COMPETITION_COURT_ERROR_CODE,
} from "../competition-core/contracts/competitionCourtAdapterContract.js";

import { createCourtResourceCompetitionAdapter } from "../competition-core/adapters/courtResourceCompetitionAdapter.js";

const courts = createCourtResourceCompetitionAdapter();
```

Do not import `CourtResourceGateway` from Tournament business modules for Competition reservation/assignment. Do not use `competitionCourtAvailabilityAdapter` or `tournamentBookingService` as the ĐẦU A contract.

---

## CAPABILITIES

| Capability | Purpose |
| ---------- | ------- |
| `listEligibleCourts` | Physical Courts the Competition context may use |
| `getCourtAvailability` | Availability for explicit `physicalCourtIds` + time window + owner |
| `reserveCourts` | Reserve explicit `physicalCourtIds` only |
| `releaseCourts` | Release only Competition-owned reservation scope |
| `validateMatchAssignment` | Validate `matchId` + `physicalCourtId` + time window + scope |

Unknown capability → `SHARED_CONTRACT_CAPABILITY_GAP`.

---

## REQUEST_SHAPES

Shared context (all capabilities):

```javascript
{
  tenantId,
  competitionId,
  competitionType, // "internal" | "official_open" | "team" | future
  clubId,
  clusterId,       // filter/scope only — not a reservable unit
  actorId,
}
```

Physical Court reference:

```javascript
{
  physicalCourtId,     // identity authority
  physicalCourtIds,    // explicit list for list/availability/reserve/release
}
```

Display-only (never identity, never reservation):

```javascript
{
  displayName,
  displayCode,
  displayNumber,
  courtLabel,
}
```

Time window (venue-local civil time):

```javascript
{
  date,        // YYYY-MM-DD
  startTime,   // HH:mm
  endTime,     // HH:mm
}
```

## OWNER_SEMANTICS

Reservation owner (stable Competition shape):

```javascript
{
  ownerType: "competition",
  ownerId: competitionId,
  competitionType,
}
```

The public owner identity is always `ownerType=competition` + `ownerId=competitionId`.  
The current gateway substrate still stores `{ type: "tournament", id: competitionId }`. That mapping lives in the binding and is replaceable in Phase 3B without changing this contract.

`courtCount` is capacity demand only. It must never be sent as a reservation identity.

---

## RESPONSE_SHAPES

Every response includes:

```javascript
{
  ok: boolean,
  contractVersion: 1,
  code: string,
  error?: string,
}
```

`listEligibleCourts` / `getCourtAvailability` courts:

```javascript
{
  physicalCourtId,
  clusterId,
  displayName,
  displayCode,
  displayNumber,
  courtLabel,          // display only
  available?,          // availability only
  resultCode?,         // AVAILABLE | OWN_RESERVATION | FOREIGN_RESERVATION | ...
  ownership?,
}
```

`reserveCourts`: `{ reserved: [{ physicalCourtId }] }`  
`releaseCourts`: `{ released: [{ physicalCourtId, reservationId }] }`  
`validateMatchAssignment`: `{ valid, matchId, physicalCourtId }`

---

## RESULT_CODES

Reused from Court Resource where the string already exists:

- `OK`
- `AVAILABLE`
- `OWN_RESERVATION`
- `ASSIGNMENT_VALID`

Competition-facing aliases over gateway authority:

- `FOREIGN_RESERVATION` ← `FOREIGN_RESERVATION_CONFLICT` / ownership `FOREIGN`
- `OUT_OF_SCOPE` ← `COURT_NOT_IN_OWNER_SCOPE`, cluster/tenant/club/venue mismatch
- `UNKNOWN_COURT` ← `COURT_NOT_FOUND`
- `MAINTENANCE` ← `COURT_MAINTENANCE` / `MAINTENANCE_CONFLICT`

---

## ERROR_CODES

Gateway codes reused as-is include:

`MISSING_CLUB_ID`, `MISSING_COURT_ID`, `MISSING_OWNER`, `MISSING_WINDOW`, `SYNTHETIC_COURT_DENIED`, `WHOLE_CLUSTER_DENIED`, `FOREIGN_RESERVATION_CONFLICT`, `DATA_UNAVAILABLE`, …

Contract-only:

- `COURT_COUNT_RESERVATION_DENIED` — `courtCount` used as reservation identity
- `SHARED_CONTRACT_CAPABILITY_GAP` — capability missing from ĐẦU A

Fail-closed: `FOREIGN_RESERVATION`, `OUT_OF_SCOPE`, `UNKNOWN_COURT`, `MAINTENANCE`.

---

## FORBIDDEN_BYPASSES

Tournament consumers of ĐẦU A must not treat any of the following as Court Authority:

- `club_data_v3`
- `court_reservations`
- booking storage
- Physical Court tables
- Club operational-access tables
- Court Engine runtime storage

ĐẦU A itself depends on `CourtResourceGateway`. It does not recreate those authorities.

---

## IDENTITY_RULES

```text
physicalCourtId = identity authority
courtLabel      ≠ identity
courtNumber     ≠ identity
courtCount      ≠ reservation authority
clusterId       ≠ reservable unit
```

A selected cluster does **not** reserve every court in that cluster.  
Club registration to a cluster does **not** imply operational access to every Physical Court in that cluster.  
Capacity must resolve to explicit `physicalCourtIds` before reservation is authoritative.  
Match assignment must use `physicalCourtId`.

Layer invariants:

```text
Court Cluster / Facility
≠ Physical Court
≠ Club Operational Access
≠ Competition Reservation
≠ Match Assignment
≠ Court Engine Live Occupancy
```

---

## PHASE3B_FORWARD_COMPATIBILITY

```text
Tournament ĐẦU B
        ↓
ĐẦU A — unchanged (this contract, version 1)
        ↓
CourtResourceGateway — stable boundary
        ↓
Canonical Atomic Reservation Authority — Phase 3B
```

Today the binding maps:

- Competition owner `{ ownerType: "competition", ownerId: competitionId }` → gateway owner `{ type: "tournament", id: competitionId }` (transitional substrate)
- `physicalCourtId` → gateway `courtId` / `selectedCourtIds`

Phase 3B may replace the reservation substrate **below** the gateway. Tournament ĐẦU B must not be rewritten for that change.

`createCourtResourceCompetitionAdapter(gatewayOverrides)` exists so the lower gateway implementation can be swapped in tests and later cutover without changing the public Competition methods.

---

## VERSIONING_POLICY

Once version 1 is merged, breaking changes to required fields, capability signatures, semantic meanings, canonical result codes, or identity rules must **not** be silently edited in place.

A breaking change requires:

1. Owner-approved shared-contract change
2. Explicit contract version decision

Tournament workstreams cannot change V1.

Backward-compatible internal implementation changes below the contract are allowed if external V1 semantics remain unchanged.

`CONTRACT_V1_BREAKING_CHANGE_POLICY_LOCKED=YES`

---

## TOURNAMENT_MODULES_MUST_NOT_MODIFY_THIS_CONTRACT

`TOURNAMENT_MODULE_CONTRACT_MODIFICATION_ALLOWED=NO`

ĐẦU B adapters (not in this workstream):

- `InternalTournamentCourtAdapter`
- `OfficialTournamentCourtAdapter`
- `OpenTournamentCourtAdapter`
- `TeamTournamentCourtAdapter`

Those adapters map Tournament-specific business shapes **into** this contract. They do not fork it.

---

## CAPABILITY_GAP_POLICY

`CAPABILITY_GAP_POLICY=SHARED_CONTRACT_CAPABILITY_GAP`

If a Tournament module discovers a missing capability, return `SHARED_CONTRACT_CAPABILITY_GAP` to the Owner. No Tournament-local workaround.
