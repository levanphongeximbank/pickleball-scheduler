# CORE-12 Phase 1D-A / 1D-A2 — Competition Availability Contract Audit and Wiring Design

| | |
|--|--|
| **Phase** | 1D-A (audit) + **1D-A2 (contract closure)** — documentation only |
| **Audit date (1D-A)** | 2026-07-22 |
| **A2 closure date** | 2026-07-22 |
| **Audited HEAD** | `ff6ca59f7bf59fc860588315af2e6a621e22074f` |
| **Branch** | `feature/competition-core-12-phase-1d-availability-wiring` |
| **Ancestor status** | Phase 1B (`1bae32bd` / PR #149) and Phase 1C (`3f6ed90d` / PR #153) present |
| **Implementation** | **None** — this document only |
| **1D-A verdict (historical)** | `CORE_12_PHASE_1D_AUDIT_READY_FOR_REVIEW` — **accepted by Owner** |
| **1D-A2 verdict** | `CORE_12_PHASE_1D_A2_CONTRACT_CLOSURE_READY_FOR_REVIEW` |
| **1D-B readiness (A2)** | `CORE12_PHASE_1D_B_REQUIRES_PORT_CONTRACT_REDESIGN` — accepted; **1D-B1 foundation implemented separately** |
| **1D-B1 status** | Contract foundation implemented + **1D-B1-C certification remediations** — see `09_PHASE_1D_AVAILABILITY_WIRING.md`; **no concrete Venue CAA provider**; structural descriptor validation ≠ verified inventory authority; locked descriptors fail closed |

> **Preserve note:** Sections 1–18 below are the original Phase 1D-A audit (kept intact as historical record). Section **19 — A2 Contract Closure** supersedes 1D-A implementation readiness claims where they conflict (especially CAA→`AvailableCourtInput` sufficiency, async model, snapshot identity, query strategy, and dependency injection).

---

## 1. Safety baseline (audited)

| Check | Result |
|-------|--------|
| Working directory | `…/competition-core-12-court-assignment` |
| Branch | `feature/competition-core-12-phase-1d-availability-wiring` |
| HEAD | `ff6ca59f…` (= `origin/main` at audit time) |
| Ahead/behind `origin/main` | 0 / 0 |
| Working tree | Clean |
| Phase 1C in ancestry | Yes (`3f6ed90d` / merge PR #153) |
| Local Phase 1D implementation | **Absent** (no `adapters/availability/**`, no `orchestration/**`, no `09_PHASE_1D_AVAILABILITY_WIRING.md` implementation doc) |
| Unrelated workstream files | None observed in dirty tree (tree clean) |

---

## 2. Competition Availability Adapter inventory

### 2.1 Canonical identity (not drifted)

| Item | Value |
|------|-------|
| Exact source | `src/features/venue-court/adapters/competitionCourtAvailabilityAdapter.js` |
| Public export | `getCompetitionCourtAvailability` |
| Public import path | `src/features/venue-court/index.js` → re-exports adapter |
| Ownership | Venue & Court |
| Docs | `docs/venue-court/PHASE_1F_COMPETITION_ADAPTER.md` (name drift from Phase 1A `competitionCourtAdapter.js` already documented; **implemented name is canonical**) |
| Tests | `tests/venue-court/competition-court-availability-adapter.test.js` |
| Downstream TE consumer | `src/features/tournament-engine/services/competitionAvailabilityGuard.js` (Phase 2B) |

**Verdict:** Documentation naming drift is resolved; `getCompetitionCourtAvailability` is the live canonical Competition-facing adapter.

### 2.2 Exported surface

| Export | Role |
|--------|------|
| `getCompetitionCourtAvailability(options)` | Production query |
| `__setCompetitionCourtAvailabilityAdapterDepsForTests` | Test DI |
| `__resetCompetitionCourtAvailabilityAdapterDepsForTests` | Test reset |

### 2.3 Input contract (source of truth: adapter JSDoc + implementation)

| Field | Required | Notes |
|-------|----------|-------|
| `clubId` | **Yes** | No first-club fallback (enforced by `getCourtAvailability`) |
| `venueId` | Optional | When set, must match club; mismatch → `VENUE_MISMATCH` |
| `date` | **Yes** | `YYYY-MM-DD` venue-local civil |
| `startTime` | **Yes** | `HH:mm` |
| `endTime` | **Yes** | `HH:mm`; **same-day**, `end > start` |
| `courtIds` | Optional | Filter / order hint |
| `clusterId` | Optional | Cluster filter |
| `includeUnavailable` | Optional | Default `true`; when `false`, `unavailableCourts` is `[]` |
| `context` | Optional | Forwarded (e.g. `excludeBookingId`) |

**Not accepted by adapter:** `tenantId`, `competitionId`, `tournamentId`, `sessionId`, IANA timezone, absolute ISO window, fingerprint, snapshot version.

Note: underlying `getCourtAvailability` accepts `tenantId` as an **alias for venueId** in scope resolution. Competition adapter does **not** document/pass `tenantId`; CORE-12 must not rely on that alias.

### 2.4 Output contract

```text
{
  clubId,
  venueId,              // may be null if not supplied upstream
  date, startTime, endTime,
  availableCourtIds,    // string[]; deterministic inventory/courtIds order
  unavailableCourts     // [{ courtId, available:false, reasons[], conflicts[] }]
}
```

| Concern | Behavior |
|---------|----------|
| Enabled/disabled | Inactive → unavailable (`COURT_INACTIVE`) — excluded from `availableCourtIds` |
| Locked inventory | `status === "locked"` / not bookable → `COURT_LOCKED` |
| Maintenance | Master `status === "maintenance"` → `COURT_MAINTENANCE`; maintenance bookings → `MAINTENANCE_BOOKING` |
| Bookings | Overlap via `checkBookingConflict`; tournament bookings → `TOURNAMENT_BOOKING_CONFLICT` |
| Operating hours | Outside open/close → `OUTSIDE_VENUE_HOURS` |
| Empty available set | Allowed: `availableCourtIds: []` (not an exception by itself) |
| Errors | Throws from canonical service (`CLUB_SCOPE_MISSING`, `VENUE_MISMATCH`, `INVALID_TIME_RANGE`, `DATA_UNAVAILABLE`) |
| Fail-closed | Missing `clubId` / invalid window / load failure throw; no silent invent-courts |
| Ordering | Preserves `getCourtAvailability` row order (inventory order or supplied `courtIds` order) |
| Determinism | No shuffle/random/Set sort |
| Mutation | Read-only reshape; copies conflict rows |
| Snapshot/fingerprint | **None** |
| Tenant/venue isolation | Club-scoped inventory; venue mismatch fails; unknown court IDs → unavailable `COURT_NOT_FOUND` |
| I/O | **Yes** — delegates to `getCourtAvailability` → club blob / settings / bookings via injectable deps |
| DI | Module-level deps + test setters only (not constructor DI) |
| Wired into Competition Engine runtime? | **TE yes** (guard); **CORE-12 court-assignment no** |
| Interval representation | **Boolean availability for entire civil window** — not absolute interval lists |

### 2.5 Important semantic: boolean window, not interval snapshot

Adapter answers: “Is court free for **this entire** civil `[startTime, endTime]` on `date`?”
It does **not** return free sub-intervals. CORE-12 Phase 1B coverage checks need absolute `availabilityIntervals` (or empty = unrestricted within snapshot). Phase 1D-B **must** materialize absolute intervals from the queried window(s) via timezone conversion — it must **not** invent availability from court existence alone.

---

## 3. CourtAvailabilityPort inventory

| Item | Value |
|------|-------|
| Exact source | `src/features/competition-core/court-assignment/ports/courtAvailabilityPort.js` |
| Production export | Method constants only: `COURT_AVAILABILITY_PORT_METHODS` via `court-assignment/index.js` / `ports/index.js` |
| Test doubles | `createFailClosedCourtAvailabilityPort`, `createFixedCourtAvailabilityPort` via `adapters/index.js` only |
| Required method | `resolveAvailability(query) → AvailabilitySnapshot` |
| Sync/async | **Sync** (current typedefs) |
| Used by `assignCourtsDeterministic`? | **No** — pure assigner never calls the port |
| Production dependency already present? | **No** live adapter wiring; fail-closed double throws `AVAILABILITY_DATA_UNAVAILABLE` |

### 3.1 Typed shapes (JSDoc only — not runtime-validated)

**AvailabilityQuery**

| Field | Notes |
|-------|-------|
| `clubId` | required (typedef) |
| `venueId` | required (typedef) |
| `courtIds?` | optional |
| `civilWindows?` | `object[]` — **not** aligned 1:1 with adapter’s single `{date,startTime,endTime}` |
| `clusterId?` | optional |
| `expectedFingerprint?` | optional; adapter has no fingerprint today |

**AvailabilitySnapshot**

| Field | Notes |
|-------|-------|
| `courts` | opaque `object[]` — intended to become `AvailableCourtInput`-compatible |
| `fingerprint` | required by fixed double |
| `snapshotId` | required |
| `snapshotVersion` | required |

### 3.2 Mismatch summary vs Competition Availability Adapter

| Topic | Adapter | Port / CORE-12 | Gap |
|-------|---------|----------------|-----|
| Time model | Civil single window | Absolute intervals + IANA timezone on request | **Anti-corruption required** |
| Output | `availableCourtIds` + reasons | `courts[]` + fingerprint/snapshot | **Projection required** |
| Scope | `clubId` (+ optional `venueId`) | Request also needs `tenantId`, `competitionId` | Orchestration supplies competition scope; adapter never sees it |
| Multi-window | Single window per call | `civilWindows[]` suggested | Orchestration must define batching policy |
| I/O | Yes | Port may perform I/O; pure assigner must not | Keep I/O in port/orchestration only |
| Empty result | Empty ID list | Phase 1B empty `courts[]` → no assignments / conflicts | Orchestration fail-closed policy needed |

**Port status:** Boundary contract + Phase 1B doubles only. Phase 1D-B must implement a production adapter-backed port **without** changing Phase 1B assigner purity.

---

## 4. Phase 1B assigner input contract (`assignCourtsDeterministic`)

Source: `services/assignCourtsDeterministic.js` + `contracts/courtAssignmentRequest.js` + policy/factories.
Certified decisions: `docs/competition-engine/core-12/07_PHASE_1B_IMPLEMENTATION_DECISIONS.md`.

### 4.1 Request shape (normalized)

| Field | Required | Notes |
|-------|----------|-------|
| `schemaVersion` | Yes | Must be `CORE12_COURT_ASSIGNMENT_SCHEMA_V1` |
| `requestId` | Yes | Stable id |
| `tenantId` | Yes | Scope |
| `clubId` | Yes | Scope |
| `venueId` | Yes | Scope |
| `competitionId` | Yes | Scope |
| `timezone` | Yes when `policy.requireVenueTimezone` (default true) | IANA |
| `matches` | Yes (array; may be empty) | `ScheduledMatchInput` |
| `courts` | Yes (array; may be empty) | `AvailableCourtInput` — **pre-supplied snapshot** |
| `lockedAssignments` | Optional | Explicit locks |
| `constraints` | Optional | |
| `policy` | Normalized via factory | Defaults listed below |
| `seed` | Optional | |
| `scheduleSnapshotRef` | Optional | |
| `availabilitySnapshotRef` | Required when `requireAvailabilitySnapshot` (default true) | `{ snapshotId, snapshotVersion, fingerprint }` |
| `metadata` | Optional | |

### 4.2 Scheduled match fields (`createScheduledMatchInput`)

| Field | Role |
|-------|------|
| `matchId`, `competitionId` | Required ids |
| `tenantId`/`clubId`/`venueId` | Optional; if present must match request |
| `scheduledStart`/`scheduledEnd` | Absolute ISO with Z/offset; required unless `allowUnscheduledMatches` |
| `civilWindow` | Optional `{date,startTime,endTime}`; overnight unsupported |
| `timezone` | Optional; must match request if both set |
| `durationMinutes` | Optional consistency check |
| `status`, `priority`, `stage` | Ordering / terminal skip |
| `requiredCapabilities` | Capability hard/soft per policy |
| `existingCourtId` + `manualCourtLock` | Implicit lock |
| `isBye` | Must not consume court |
| `_startMs`/`_endMs` | Internal epoch (not caller API) |

### 4.3 Court / availability interval fields (`createAvailableCourtInput`)

| Field | Role |
|-------|------|
| `courtId`, `venueId`, `clubId` | Required; must match request scope |
| `availabilityStatus` | `AVAILABLE` / `UNAVAILABLE` / `LOCKED` / `MAINTENANCE` / `DISABLED` |
| `active`, `eligible` | Soft inventory gates |
| `availabilityIntervals` | Absolute half-open; **empty + AVAILABLE = unrestricted within snapshot** |
| `availabilityWindows` | Opaque civil metadata (not used for coverage math) |
| `capabilities`, `priority`, `unavailableReasons`, `metadata` | Selection / diagnostics |

### 4.4 Semantics relevant to Phase 1D

| Topic | Behavior |
|-------|----------|
| Partial assignment | Default **false** → hard conflict `PARTIAL_ASSIGNMENT_NOT_ALLOWED` |
| Committable | Result statuses SUCCESS / PARTIAL / CONFLICT / REJECTED; no persistence |
| Empty availability inside request | Empty `courts[]` → no eligible courts → unassigned / conflict path |
| Pre-normalization | **Yes** — courts must already be snapshot DTOs; assigner does not fetch |
| I/O | **None** |
| Deterministic ordering | Match: priority then id; Court: priority then id (UTF-16 compare) |
| Fingerprint | Result fingerprint includes assignment material + snapshot refs |
| Overlap | Half-open; adjacent OK; in-request court occupancy only |
| Coverage | Match must be fully covered by **one** interval; intervals **not** merged |

---

## 5. CORE-11 scheduled-match contract

### 5.1 What exists on audited HEAD

| Surface | Path | Status |
|---------|------|--------|
| CORE-12 capability-local DTO | `court-assignment/contracts/scheduledMatchInput.js` | **Production for CORE-12 requests** — explicitly **not** final CORE-11 |
| CC-09 scheduling contracts | `competition-core/scheduling/schedulingContracts.js` | Schedule generation / shadow; `SchedulingMatch` has **no** scheduled start/end; times live on `SchedulingAssignment` |
| TE match fields | TE engines / director | Legacy joint packer; `scheduledStart`/`scheduledEnd` ISO + `courtId` |
| Public final CORE-11 scheduled-match contract | — | **Not present** on main (confirmed by `05_INTEGRATION_BOUNDARIES.md` §4) |

### 5.2 De facto fields CORE-12 needs

| Concern | CORE-12 expectation | Upstream today |
|---------|---------------------|----------------|
| Match id | `matchId` | TE `id` / scheduling `matchId` |
| Competition scope | `competitionId` | Often tournament/event id — mapping needed |
| Venue/club/tenant | Optional on match; required on request | TE context fields |
| Start/end | Absolute ISO Z/offset | TE ISO; scheduling assignment `startTime`/`endTime` string (format not hardened as CORE-12 absolute) |
| Timezone | Request-level IANA | TE/`resolveVenueTimezoneForClub` |
| Status / bye | Supported | Present in TE |
| Court lock | `manualCourtLock` + `existingCourtId` | TE `manualCourtLock` + `courtId` |
| Unscheduled | Rejected by default | Possible in TE |
| Cross-midnight | Allowed as absolute intervals; civil overnight **not** representable to adapter | Adapter same-day only |
| Absolute instants | Required | TE generally ISO; must reject timezone-less |

### 5.3 Consumption rule for Phase 1D

- CORE-12 may consume **capability-local** `ScheduledMatchInput` directly.
- A **scheduled-match anti-corruption adapter** is **required** for TE / CC-09 scheduling payloads.
- Do **not** import schedule-generation internals (`calculateCanonicalSchedule`, TE `generateSchedule`) into court-assignment domain.
- Phase 1C TE-compat adapter already maps TE court-assignment **inputs** for shadow parity — reuse patterns, keep isolated under `adapters/te-compat/` / new Phase 1D adapters; do not promote to production cutover.

---

## 6. CORE-14 future integration contract

| Item | Value |
|------|-------|
| Public surface | `src/features/competition-core/resource-conflict/index.js` |
| Primary APIs | `detectResourceConflicts`, `proposeResourceConflictResolutions`, adapters/projectors |
| Court support | `RESOURCE_KIND.COURT`; `adaptCourtAssignmentsToResourceOccupancies`; projector `projectConflictResultForCourtAssignment` |
| Half-open time | CORE-14 time helpers (`validateHalfOpenInterval`, `intervalsOverlap`) |
| I/O | Pure / DI; availability via separate availability facts/port — **not** wired to live Venue adapter in production runtime |
| Phase status | Capability exists but documented as dormant / unwired for production Integrator paths |
| Phase 1D need | **No** — defer wiring |
| Safe for future CORE-12? | Yes via published occupancy + projector contracts; CORE-12 must not reimplement detector catalog |

**Phase 1D-A decision:** CORE-14 remains deferred. In-request overlap stays owned by CORE-12 Phase 1B assigner.

---

## 7. Existing runtime call-site inventory

| Call site | Path | Classification |
|-----------|------|----------------|
| TE court assignment + Venue filter | `tournament-engine/engines/courtAssignmentEngine.js` | **legacy-only** / **future migration candidate** |
| TE schedule generation + Venue filter | `tournament-engine/engines/scheduleEngine.js` | **out of scope** (schedule generation) |
| TE availability guard (adapter consumer) | `tournament-engine/services/competitionAvailabilityGuard.js` | **reusable pattern** (civil window + fail-closed); **not** CORE-12 production path |
| TE orchestrator | `tournament-engine/orchestrator/tournamentEngine.js` | **legacy-only** |
| TE hook `assignCourtsAuto` / `runFullPlan` | `tournament-engine/hooks/useTournamentEngine.js` | **legacy-only** / **out of scope** for 1D-B |
| Director one-court assign | `tournament/engines/tournamentDirectorEngine.js` → `assignTournamentMatchToAvailableCourt` | **legacy-only** / **future migration candidate** |
| Director UI hook | `features/tournament/director/hooks/useDirectorActions.js` | **out of scope** (UI) |
| Publish schedule | `tournament/engines/publishScheduleEngine.js` + pages/panels | **out of scope** |
| Daily Play court engine | `tournament/engines/courtEngine.js` (`getAvailableCourts`) | **unsafe** as CORE-12 availability source / **out of scope** |
| Competition Availability Adapter | `venue-court/adapters/competitionCourtAvailabilityAdapter.js` | **reusable** (mandatory source) |
| Venue public facade | `venue-court/index.js` | **reusable** import boundary for port impl |
| CORE-12 pure assigner | `court-assignment/services/assignCourtsDeterministic.js` | **reusable** (unchanged) |
| CORE-12 CourtAvailabilityPort doubles | `court-assignment/ports/courtAvailabilityPort.js` | **reusable** contract; production impl missing |
| CORE-12 Phase 1C TE-compat | `court-assignment/adapters/te-compat/**` | **isolated** / **not** production wiring |
| CORE-12 shadow parity | `court-assignment/parity/**` | **isolated** |
| CC-09 scheduling | `competition-core/scheduling/**` | **out of scope** for availability calc; future scheduled-match ACA only |
| CORE-14 | `competition-core/resource-conflict/**` | **deferred** |
| Direct Venue imports from `court-assignment/` | — | **None** found (good) |

---

## 8. Contract gap matrix (field-level)

Legend: **CAA** = Competition Availability Adapter; **Port** = CourtAvailabilityPort; **1B** = `assignCourtsDeterministic` request; **SM** = ScheduledMatchInput / future CORE-11; **14** = CORE-14 (future).

| Field | CAA in | CAA out | Port | 1B request | SM / CORE-11 | CORE-14 | Mapping / owners | Missing behavior | Adapter required? |
|-------|--------|---------|------|------------|--------------|---------|------------------|------------------|-------------------|
| `tenantId` | no (alias only in deeper service) | no | no | **required** | optional on match | scope on occupancy | Orchestration supplies; never invent | Reject if missing | Yes (orchestration) |
| `venueId` | optional in | out (nullable) | required in query typedef | **required** | optional | CRK scope | Must match club; fail on mismatch | Reject / `VENUE_MISMATCH` | Yes |
| `clubId` | **required** | out | required | **required** | optional | scope | Propagate exactly | Reject | Yes |
| `competitionId` | no | no | no | **required** | required on SM | activity identity | Orchestration/request only | Reject | Yes (orchestration) |
| `tournamentId` | no | no | no | via `competitionId` / metadata | TE often tournament id | optional | Map TE tournament→competition explicitly | Ambiguity risk — fail closed if ambiguous | Yes |
| `sessionId` | no | no | no | metadata only | TE scheduleConfig sessions | no | Not a CORE-12 scope key | Ignore or metadata | Optional |
| `matchId` | no | no | no | via matches | required | occupancy activity | Pass-through | Reject duplicates | SM ACA if legacy ids |
| `courtId` | filter `courtIds` | `availableCourtIds` / unavailable | courts[].courtId | courts[].courtId | lock fields | CRK id | String stable ids | Unknown court unavailable | Yes (projection) |
| surface / capability | no | no | opaque courts | `capabilities` / `requiredCapabilities` | optional | not availability | **Not provided by CAA** — omit or supply from separate inventory snapshot if Owner approves | Capability hard mode may no-op if empty | Risk: do not invent |
| `scheduledStart`/`End` | no | no | no | absolute on match | absolute expected | occupancy interval | SM → 1B | Reject unscheduled | SM ACA |
| `windowStart`/`End` (query) | `date+startTime+endTime` civil | echoed | `civilWindows[]` | not on request (intervals on courts) | civilWindow optional | detection window | Civil query → absolute intervals on courts | Reject missing/invalid | **Yes** |
| `timezone` | none (civil assumed venue-local) | none | none | **required** (default policy) | optional | absolute ms | Caller supplies IANA; convert with `civilTime.js` | `TIMEZONE_REQUIRED` | Yes |
| availability intervals | implicit whole window boolean | none | courts[] | `availabilityIntervals` | n/a | availability facts | Materialize absolute `[queryStart, queryEnd)` for available IDs | Empty CAA IDs → empty courts / fail-closed | **Yes** |
| enabled / active | evaluated | unavailable reasons | — | `active`/`eligible`/`DISABLED` | — | — | Map inactive → exclude or DISABLED | Exclude from available set | Yes |
| locked inventory | evaluated | `COURT_LOCKED` | — | `LOCKED` status | — | — | Exclude from available; optional unavailable diagnostic | Exclude | Yes |
| `manualCourtLock` | no | no | no | match + locks | TE fields | no | SM ACA | Unknown lock court → conflict/reject | SM ACA |
| priority | no | no | no | court/match priority | TE priority | no | Default 0 if unknown | Deterministic tie-break by id | Optional |
| court metadata | limited public court on canonical rows (not on CAA out) | reasons/conflicts only | opaque | `metadata`/`unavailableReasons` | — | — | Map reasons into `unavailableReasons` if including unavailable | Diagnostics only | Optional |
| snapshot version / fingerprint | none | none | required on snapshot | `availabilitySnapshotRef` | schedule refs optional | FP versions | **Compute capability-local fingerprint** over canonical projection | Fail if `expectedFingerprint` mismatch | **Yes** |

Validation owners:

- CAA / Venue: club/venue civil window, inventory, bookings, hours.
- Phase 1D port/orchestration: timezone, absolute materialization, snapshot refs, competition/tenant scope, fail-closed empty snapshot.
- Phase 1B assigner: request schema, in-request overlap, coverage, locks, capabilities.
- CORE-14 (later): cross-module conflicts only.

---

## 9. Timezone and interval certification design (proposed Phase 1D rules)

### 9.1 Canonical utilities to reuse (do not reinvent in 1D-A)

| Utility | Path |
|---------|------|
| Absolute instant validation (CORE-12) | `court-assignment/deterministic/intervals.js` (`requireAbsoluteInstant`, half-open helpers) |
| Civil + absolute conversion (Venue) | `src/domain/civilTime.js` (`assertIanaTimezone`, `civilDateTimeToUtcMs`, `absoluteToCivil*`, `resolveVenueTimezoneForClub`) |
| TE civil window helpers (pattern only) | `competitionAvailabilityGuard.js` — **do not import into CORE-12 domain**; mirror patterns capability-locally if needed |

### 9.2 Proposed rules

| # | Topic | Proposed Phase 1D rule |
|---|-------|------------------------|
| 1 | Absolute instant format | ISO-8601 with `Z` or numeric offset; reject timezone-less local forms (CORE-12 `ABSOLUTE_INSTANT_RE`) |
| 2 | Timezone id | IANA string via `assertIanaTimezone` / `requireTimezone`; no host default |
| 3 | Window start/end (CAA query) | Venue-local civil `YYYY-MM-DD` + `HH:mm`; same-day; `end > start` |
| 4 | Match start/end | Absolute half-open; required unless policy allows unscheduled (default forbid) |
| 5 | Availability start/end on courts | Absolute intervals materialized from certified civil query window(s) using `civilDateTimeToUtcMs` |
| 6 | Half-open | `[start, end)`; CORE-12 + CORE-14 aligned |
| 7 | Equal endpoints | Invalid (zero-length) |
| 8 | Reversed endpoints | Invalid |
| 9 | Timezone-less input | Fail closed (`TIMEZONE_REQUIRED` / `INVALID_TIME_WINDOW`) |
| 10 | DST | Conversion must use IANA zone via civilTime helpers; never `Date#getHours` host local |
| 11 | Overnight venue hours | **Unsupported** by CAA today — fail closed / do not invent split windows |
| 12 | Cross-midnight matches | Absolute OK inside assigner; civil overnight query **unsupported** — reject civil representation |
| 13 | Adjacent intervals | Non-overlapping (assigner); do not merge for coverage |
| 14 | Interval merging | **Forbidden** in Phase 1D-B projection (match Phase 1B) |
| 15 | Invalid calendar dates | Reject (CORE-12 component assert + civilTime strict date) |
| 16 | Machine-local independence | Tests must pin timezone; no reliance on host TZ |

**Recommended 1D-B query strategy (conservative):** orchestration requires an explicit civil `queryWindow` that **covers all match absolute intervals** after conversion; single CAA call; materialize one absolute interval per available court equal to that window. Matches outside window → fail closed before assigner. (Alternative multi-window batching may be a later subphase; must remain fail-closed and deterministic.)

---

## 10. Fail-closed matrix (proposed)

| # | Case | Owning layer | Proposed stable code | Block execution? | Partial allowed? | Committable? | Audit metadata? |
|---|------|--------------|----------------------|------------------|------------------|--------------|-----------------|
| 1 | Missing tenant | Orchestration / request factory | `INVALID_REQUEST` / missing stable id | Yes | No | No | Yes |
| 2 | Missing venue | Orchestration / request | `INVALID_REQUEST` | Yes | No | No | Yes |
| 3 | Missing club when required | Orchestration + CAA | `CLUB_SCOPE_MISSING` / map to `AVAILABILITY_DATA_UNAVAILABLE` or rejection | Yes | No | No | Yes |
| 4 | Ambiguous multi-club | Orchestration | `SCOPE_MISMATCH` | Yes | No | No | Yes |
| 5 | Missing competition/tournament scope | Orchestration | `INVALID_REQUEST` / `SCOPE_MISMATCH` | Yes | No | No | Yes |
| 6 | Missing timezone | Policy / request | `TIMEZONE_REQUIRED` | Yes | No | No | Yes |
| 7 | Timezone-less instant | Intervals / SM | `INVALID_TIME_WINDOW` | Yes | No | No | Yes |
| 8 | Missing query window | Orchestration | `INVALID_CIVIL_WINDOW` / `SCHEDULE_WINDOW_MISSING`-style local code mapped to CORE-12 rejection | Yes | No | No | Yes |
| 9 | Invalid query window | CAA / orchestration | `INVALID_TIME_WINDOW` / `INVALID_CIVIL_WINDOW` | Yes | No | No | Yes |
| 10 | Empty canonical availability snapshot | Orchestration | `AVAILABILITY_DATA_UNAVAILABLE` or reject with empty courts policy | Yes (default) | No (default) | No | Yes |
| 11 | Adapter returns no courts | Orchestration | Same as empty snapshot / proceed to assigner only if explicitly allowed | Yes default | No | No | Yes |
| 12 | Adapter error | Port | `AVAILABILITY_DATA_UNAVAILABLE` | Yes | No | No | Yes |
| 13 | Timeout / unavailable dependency | Port | `AVAILABILITY_DATA_UNAVAILABLE` | Yes | No | No | Yes |
| 14 | Court from another venue | 1B validation | `CROSS_VENUE_REFERENCE` | Yes | No | No | Yes |
| 15 | Disabled court | CAA exclude / 1B | Excluded or `COURT_DISABLED` | Per-match conflict | Policy | Only if SUCCESS/PARTIAL policy | Yes |
| 16 | Locked inventory court | CAA exclude / 1B | `COURT_LOCKED_INVENTORY` | Per-match | Policy | Policy | Yes |
| 17 | Missing court intervals | 1B | Empty intervals + AVAILABLE = unrestricted **only after** CAA certified availability | N/A if projection always writes window interval | — | — | Prefer always materialize window interval |
| 18 | Empty court intervals | 1B | Unrestricted if AVAILABLE | — | — | — | Document risk; prefer explicit interval |
| 19 | Invalid intervals | 1B factory | `INVALID_TIME_WINDOW` | Yes | No | No | Yes |
| 20 | Match outside query window | Orchestration | `INVALID_TIME_WINDOW` / `WINDOW_INCOMPATIBLE` | Yes | No | No | Yes |
| 21 | Match outside every court interval | 1B | `WINDOW_INCOMPATIBLE` / `NO_ELIGIBLE_COURT` | Per-match | Policy | Policy | Yes |
| 22 | Unscheduled match | 1B | `INVALID_TIME_WINDOW` | Yes | No | No | Yes |
| 23 | Unknown manual lock | 1B | `LOCK_REFERENCES_UNKNOWN_COURT` / match | Yes/conflict | Policy | No if reject | Yes |
| 24 | Manual lock to unavailable court | 1B | `LOCK_COURT_UNAVAILABLE` | Conflict/reject | Policy | No if hard | Yes |
| 25 | Duplicate court IDs | 1B | `DUPLICATE_COURT_ID` | Yes | No | No | Yes |
| 26 | Duplicate match IDs | 1B | `DUPLICATE_MATCH_ID` | Yes | No | No | Yes |
| 27 | Scope mismatch matches↔availability | 1B / orchestration | `SCOPE_MISMATCH` / `CROSS_*` | Yes | No | No | Yes |
| 28 | Snapshot version / fingerprint mismatch | Port | New or `NON_CANONICAL_VALUE` / `AVAILABILITY_DATA_UNAVAILABLE` | Yes | No | No | Yes |

---

## 11. Proposed Phase 1D-B architecture

```text
Integrator / test host
  │
  ▼
orchestration/assignCourtsFromCanonicalAvailability(input)
  │  validate tenant/club/venue/competition/timezone/queryWindow
  │  adapt scheduled matches → ScheduledMatchInput[]  (ACA)
  │
  ├─► CourtAvailabilityPort.resolveAvailability(query)
  │      └─► getCompetitionCourtAvailability (Venue owned)
  │      └─► project → AvailableCourtInput[] + snapshotId/version/fingerprint
  │
  └─► assignCourtsDeterministic(CourtAssignmentRequest)
         └─► pure greedy result (no I/O, no persistence)
```

### 11.1 Phase 1D-B **should** create

1. Production Competition Availability Adapter-backed `CourtAvailabilityPort` implementation.
2. Scheduled-match → CORE-12 anti-corruption adapter (TE/legacy → `ScheduledMatchInput`), capability-local.
3. Orchestration function that: receives already-scheduled matches; requests canonical availability; validates scope/timezone; invokes `assignCourtsDeterministic`; returns deterministic results; **no persistence**.
4. Capability-local version constants (e.g. `CORE12_AVAILABILITY_PORT_V1`, `CORE12_PHASE_1D_ORCHESTRATION_V1`).
5. Capability-local production exports from `court-assignment/index.js` only (no root barrel).
6. Audit metadata on orchestration result (adapter call fingerprint, query window, codes).
7. Tests: `tests/competition-core-court-assignment-core12-phase1d.test.js`.
8. Docs: `docs/competition-engine/core-12/09_PHASE_1D_AVAILABILITY_WIRING.md` (implementation record; separate from this audit).

### 11.2 Phase 1D-B must **not** create

- Tournament Engine cutover / `runFullPlan` changes
- UI wiring
- Persistence / Supabase / SQL
- Schedule generation
- Court inventory / operating-hours / booking calculation
- Direct Venue repository imports when CAA already owns the boundary (import **only** `getCompetitionCourtAvailability` from venue-court public facade)
- CORE-14 implementation or duplication
- Referee logic
- Root `competition-core/index.js` export changes
- Changes to Phase 1B assigner semantics
- Production wiring of Phase 1C TE-compat into TE runtime

---

## 12. Proposed Phase 1D-B file scope

### 12.1 New (capability-local)

```text
src/features/competition-core/court-assignment/adapters/availability/
  createCompetitionCourtAvailabilityPort.js
  projectCompetitionAvailabilitySnapshot.js
  index.js
src/features/competition-core/court-assignment/adapters/scheduled-match/
  adaptScheduledMatchesToCourtAssignmentInput.js   # name flexible
  index.js
src/features/competition-core/court-assignment/orchestration/
  assignCourtsFromCanonicalAvailability.js
  index.js
src/features/competition-core/court-assignment/contracts/
  availabilityQuery.js          # optional runtime validation for Port query
  orchestrationRequest.js       # optional
tests/competition-core-court-assignment-core12-phase1d.test.js
docs/competition-engine/core-12/09_PHASE_1D_AVAILABILITY_WIRING.md
```

### 12.2 Likely local modifications (CORE-12 owned)

| File | Why | Extra ownership auth? |
|------|-----|------------------------|
| `court-assignment/constants/versions.js` | Phase 1D version pins | No (capability-local) |
| `court-assignment/index.js` | Export orchestration + production port factory | No |
| `court-assignment/adapters/index.js` | Optionally re-export production availability port (or keep under `adapters/availability` only) | No |
| `ports/courtAvailabilityPort.js` | Tighten typedefs / shared error type only if needed | No — avoid behavior change to doubles |

### 12.3 Upstream files

| File | Modify in 1D-B? | Notes |
|------|-----------------|-------|
| `venue-court/adapters/competitionCourtAvailabilityAdapter.js` | **No** (default) | Consume as-is; Owner auth required if fingerprint/timezone added upstream |
| `venue-court/index.js` | **No** | Already exports CAA |
| `domain/civilTime.js` | **No** | Import helpers only |
| TE engines / guard | **No** | Remain legacy |
| CORE-11 / scheduling | **No** | ACA only if consuming payloads |
| CORE-14 | **No** | Deferred |
| Root competition-core barrel | **No** | Forbidden |

---

## 13. Proposed Phase 1D-B test catalog

1. Successful single-match / single-court assignment via orchestration
2. Multiple matches and courts
3. Canonical availability adapter invoked with exact club/venue/window
4. Exact scope propagation (`tenantId`/`clubId`/`venueId`/`competitionId`)
5. Exact query-window propagation to CAA
6. Timezone propagation + absolute materialization
7. Empty availability fail-closed
8. Missing club fail-closed
9. Ambiguous multi-club fail-closed
10. Cross-venue court rejected
11. Disabled court excluded
12. Locked court excluded / represented correctly
13. Maintenance exclusion
14. Booking exclusion
15. Half-open interval adjacency (assigner regression via orchestration)
16. Cross-midnight absolute match with same-day civil query rules
17. Machine timezone independence
18. Manual lock to available court
19. Manual lock to unavailable court
20. Partial assignment policy paths
21. Deterministic ordering
22. Input permutation invariance
23. Fingerprint stability (snapshot + result)
24. Adapter error → fail-closed
25. No mutation of caller input
26. No direct Venue repository / Supabase import from new files
27. No TE runtime dependency from orchestration production path
28. No CORE-14 duplication
29. Phase 1B regression suite still green
30. Phase 1C regression / isolation still green

---

## 14. Architecture and dependency assessment

| # | Constraint | Proposed design preserves? |
|---|------------|----------------------------|
| 1 | No cyclic dependency | Yes — venue-court ← court-assignment (one way) |
| 2 | No TE→CORE-12 dependency | Yes — no TE changes |
| 3 | No CORE-12→TE runtime dependency | Yes — orchestration must not import TE engines |
| 4 | No direct Supabase import | Yes |
| 5 | No direct Venue repository import | Yes — CAA public export only |
| 6 | No UI import | Yes |
| 7 | No route import | Yes |
| 8 | No schedule generation import | Yes |
| 9 | No CORE-14 duplication | Yes — deferred |
| 10 | No root export change | Yes |
| 11 | Capability-local versioning | Yes |
| 12 | Deterministic pure assignment core | Yes — assigner untouched |

---

## 15. Risks

1. **CAA boolean window ≠ CORE-12 interval snapshot** — incorrect projection could over-claim availability; mitigate by materializing exact query window and requiring matches ⊆ window.
2. **No upstream fingerprint** — local fingerprint algorithm must be version-pinned and tested.
3. **Capabilities/surfaces absent from CAA** — hard capability matching may be vacuous unless separately supplied.
4. **Overnight / multi-day** unsupported by CAA — product limitation; fail closed.
5. **TE already consumes CAA** — risk of accidental TE cutover if engineers “reuse” guard inside CORE-12; keep capability-local port.
6. **CORE-11 contract unfinished** — scheduled-match ACA required; ambiguity tournamentId↔competitionId.
7. **Empty `availableCourtIds`** — must not soft-succeed as SUCCESS with zero work unless policy explicitly allows empty match set.
8. **Docs drift** — Phase 1F said Competition runtime unwired; Phase 2B wired TE guard — CORE-12 must still treat CAA as Venue-owned boundary.

## 16. Blockers

| Blocker? | Item | Status |
|----------|------|--------|
| Hard block? | CAA missing | **No** — present and tested |
| Hard block? | CourtAvailabilityPort missing | **No** — boundary exists; production impl designed for 1D-B |
| Hard block? | CORE-11 final contract | **No for 1D-B availability wiring** — use capability-local SM + ACA; flag as integration risk |
| Hard block? | Timezone utilities | **No** — `civilTime.js` + CORE-12 intervals exist |
| Hard block? | Architecture collision | **No** if 1D-B stays capability-local and TE untouched |

No `BLOCKED_*` condition is raised for starting Phase 1D-B design approval; Owner review of projection/fingerprint rules is required before coding.

## 17. Explicit non-goals (Phase 1D-A and proposed 1D-B)

- Production TE cutover
- UI / SQL / Supabase / deploy
- Schedule generation ownership
- Availability calculation ownership
- CORE-14 wiring
- Root Competition Core export changes
- Changing Phase 1B deterministic semantics
- Merging Phase 1C TE-compat into production TE

## 18. Recommended verdict

**`CORE_12_PHASE_1D_AUDIT_READY_FOR_REVIEW`**

Next authorized action (Owner): approve Phase 1D-B implementation boundary in §11–§13, then authorize coding **without** TE cutover.

> **A2 supersession:** Owner accepted 1D-A audit. Full Phase 1D-B is **not** authorized. Implementation readiness is revised in **§19**. Do not treat §11–§13 as sufficient authorization to invent court descriptors, source snapshots, or sync-over-Promise I/O.

---

## 19. A2 Contract Closure (Phase 1D-A2)

| | |
|--|--|
| **Phase** | 1D-A2 — audit + contract design + documentation only |
| **Date** | 2026-07-22 |
| **HEAD at A2** | `ff6ca59f7bf59fc860588315af2e6a621e22074f` |
| **origin/main at A2** | `a3422a37…` (branch **behind by 2**; unrelated CORE-10 merges — not in scope) |
| **Dirty paths** | Only this document (untracked/updated) |
| **Runtime changes** | None |

### 19.1 Audit approval vs implementation readiness

| Statement | Status |
|-----------|--------|
| Phase 1D-A inventory of CAA / Port / Phase 1B / call sites | **Accepted** |
| Phase 1D-B coding of CAA-backed production wiring | **Not authorized** |
| Inventing court metadata / capabilities / priority from `availableCourtIds` | **Prohibited** |
| Fabricating upstream `sourceSnapshotId` / random UUIDs | **Prohibited** |
| Hiding Promise I/O behind a sync port | **Prohibited** |
| Claiming current CAA alone builds valid `AvailableCourtInput` | **Rejected** — see §19.2 |

### 19.2 AvailableCourtInput source closure

Phase 1B factory fields (`createAvailableCourtInput`):

| Field | Authoritative source | Classification |
|-------|----------------------|----------------|
| `courtId` | CAA `availableCourtIds[]` (eligibility only) **or** caller descriptor id intersected with eligibility | **1** id from CAA; **not** a full descriptor |
| `venueId` | Orchestration request scope (required). CAA `venueId` may be **null** — must not invent | **3** required from orchestration; CAA echo is corroboration only when non-null |
| `clubId` | CAA response `clubId` must equal orchestration `clubId` | **1** + **3** (must match) |
| `tenantId` | Orchestration request (optional on court; required on request) | **3** |
| `availabilityStatus` | For IDs in `availableCourtIds` only → `AVAILABLE`. Unavailable rows → exclude from assignable set (optional diagnostics) | **2** for available IDs only |
| `availabilityIntervals` | **Only** the exact queried civil window converted to one absolute half-open interval (see §19.5). Not emitted by CAA | **2** from query+timezone+CAA echo; never invent all-day |
| `active` | Not in CAA response | **4** unavailable / **5** prohibited to infer as true from ID presence alone |
| `eligible` | Not in CAA response | **4** / **5** same |
| Locked inventory state | Encoded only as absence from `availableCourtIds` (+ optional `unavailableCourts` reasons). Not a court descriptor field | **2** as eligibility exclusion only |
| `capabilities` / surface | Not in CAA | **4** / **5** — CORE-12 must not invent |
| `priority` | Not in CAA | **4** / **5** — default `0` is a **policy fill**, not Venue truth; must not be claimed as CAA-sourced |
| `unavailableReasons` | CAA `unavailableCourts[].reasons` when including unavailable diagnostics | **1** optional diagnostics |
| `availabilityWindows` | Echo of queried civil window (orchestration/query metadata) | **2** |
| `metadata` | Not owned by CAA | **3** optional caller / **5** no Venue invention |
| Snapshot reference (`availabilitySnapshotRef`) | Not supplied by CAA | See §19.7 — **derived** only; never fake source identity |

**Classification key:** (1) CAA direct (2) safely derivable from exact CAA query+response (3) orchestration input (4) unavailable under current contract (5) prohibited for CORE-12 to infer.

#### CAA sufficiency verdict

**Current CAA response is not sufficient to construct a valid Phase 1B `AvailableCourtInput` without an additional court-descriptor source.**

Reasons:

1. `availableCourtIds` are **eligibility IDs only**, not court descriptors.
2. Required `venueId` may be null on CAA output while Phase 1B requires it.
3. `active`, `eligible`, `capabilities`, surface, and authoritative `priority` are absent.
4. Absolute intervals are not returned; only a boolean whole-window answer exists.
5. Filling defaults (`active: true`, `eligible: true`, `capabilities: {}`, `priority: 0`) while attributing them to Venue would be **contract fraud**.

**Sufficiency finding:** `BLOCKED_UPSTREAM_COURT_DESCRIPTOR_CONTRACT`

This finding is **closed for design** by selecting Option C (§19.3), not by pretending CAA is complete.

### 19.3 Upstream bridge options

#### OPTION A — Extend Venue & Court CAA response

Add `availableCourts[]` (and optional unavailable descriptors) with only Venue-owned validated fields.

| Topic | Assessment |
|-------|------------|
| Additional fields required at minimum | `courtId`, `venueId`, `clubId`, `active`, inventory lock/maintenance flags or normalized status, optional `clusterId`; optional public name/number |
| Absolute intervals upstream? | **Preferred long-term** but not required if response still certifies whole-window boolean **and** echoes civil window + optional IANA timezone used for certification |
| Timezone emitted? | **Yes recommended** if Venue owns civil→absolute; otherwise callers remain timezone owners |
| Capability / surface in Venue? | Only if Venue already owns those attributes on inventory; do not invent for Competition |
| Source snapshot metadata? | Optional Venue fingerprint of inventory+bookings+settings revision — valuable but new contract |
| Venue tests | Projection shape, ordering, no Competition fields, TE consumer compatibility |
| Ownership auth | **Required** (Venue & Court Owner) |
| TE impact | Additive fields are compatible if TE keeps using `availableCourtIds`; must not break guard |

**Pros:** Single truth for available court descriptors. **Cons:** Blocks CORE-12 on upstream schedule; expands CAA beyond current TE need.

#### OPTION B — Caller supplies canonical court descriptors

CAA validates availability by ID; orchestration supplies descriptors; intersect by `courtId`.

| Topic | Assessment |
|-------|------------|
| Descriptor owner | Integrator / product host / future Venue inventory port — **not** CORE-12 calculation |
| Cross-venue / stale reject | Descriptor `venueId`/`clubId` must match request; id must appear in CAA `availableCourtIds` for the exact window; mismatch → fail closed |
| Capabilities / surface | Remain on caller descriptors; CORE-12 does not validate against Venue inventory in Phase 1D |
| Two sources of truth? | **Yes** — eligibility (CAA) vs attributes (caller). Acceptable only if attributes are never claimed as CAA-sourced and eligibility always gates assignment |
| Acceptable? | Conditionally — works without Venue change, but port shape still overclaims if it returns full `courts[]` as “availability snapshot” |

#### OPTION C — Narrow ID-only availability eligibility port (**RECOMMENDED**)

CAA-backed surface returns **eligible court IDs + query echo + derived fingerprints** for the exact window. Canonical court descriptors are a **separate** orchestration input. Bridge intersects IDs → builds `AvailableCourtInput` only from (descriptor ∩ eligible) + whole-window interval projection.

| Topic | Assessment |
|-------|------------|
| Redesign `CourtAvailabilityPort`? | **Yes** — must not pretend CAA returns full `AvailableCourtInput[]` |
| Snapshot / fingerprint | Eligibility snapshot is **derived**; see §19.7 |
| Metadata validation | Outside CORE-12 except scope id equality + eligibility intersection |
| Ownership boundaries | Clean: Venue owns availability calculation; caller owns descriptors; CORE-12 owns assignment over certified intersection |

**Do not** propose a direct CORE-12 court repository / `listCourts` / Supabase query.

#### Recommended bridge architecture

**OPTION C — ID-only eligibility port + separate canonical court descriptors + whole-window interval projection.**

Rationale: closes `BLOCKED_UPSTREAM_COURT_DESCRIPTOR_CONTRACT` without inventing Venue fields; keeps CAA unchanged for TE; makes port honesty match upstream truth.

### 19.4 Async contract closure

#### Production CAA Promise audit

`getCompetitionCourtAvailability` is a **synchronous** function returning a plain object on all production paths (no `async`, no `Promise`). Underlying `getCourtAvailability` is likewise sync (local club blob I/O).

#### Current `CourtAvailabilityPort` uses

| Use | Behavior |
|-----|----------|
| Typedef | Sync `resolveAvailability(query) => AvailabilitySnapshot` |
| Fail-closed / fixed doubles | Sync throw / sync return |
| Phase 1B tests | Sync only |
| `assignCourtsDeterministic` | Does not call the port |
| Production CORE-12 wiring | None |

#### Design comparison

| | DESIGN 1 — `async resolveAvailability` | DESIGN 2 — async orchestration loads snapshot → sync mapper/port | DESIGN 3 — sync eligibility port + separate async `AvailabilitySnapshotProvider` |
|--|----------------------------------------|-------------------------------------------------------------------|------------------|
| Contract clarity | Port = I/O dependency | Clear load vs pure map | Clearest separation of I/O vs pure |
| Testability | Async tests everywhere | Orchestration async; mapper sync | Provider mockable async; port/mapper pure sync |
| Compatibility | Breaks current sync doubles / typedef | Compatible with sync doubles as mappers | Requires new provider contract; port may be narrowed |
| Error propagation | Rejected Promise | Orchestration catches | Provider rejects; orchestration maps codes |
| Timeout | Needs Abort/timeout at port | At load step | At provider |
| Deterministic core isolation | Risk if assigner awaits | Good | **Best** |
| Future reuse | OK if all I/O async | OK | Best for sync CAA today + async Venue later |
| Versioning | Port v2 async | Orchestration version | Provider + eligibility-port versions |
| Migration | Forces async on sync CAA (`Promise.resolve` smell) | Mild | Explicit |

**Forbidden:** wrapping CAA in a sync port that blocks on hidden Promises.

#### Recommended async model

**DESIGN 3.**

- `AvailabilitySnapshotProvider.loadEligibility(query) → Promise<EligibilitySnapshot>` (async boundary; may `await` sync CAA via `Promise.resolve` **only** when documented as sync-backed adapter, or later true async Venue I/O).
- Sync pure mapper / narrowed eligibility port projects IDs → intersection with descriptors (no I/O).
- Async orchestration awaits provider, then calls sync `assignCourtsDeterministic`.

Current CAA sync nature does **not** authorize a sync I/O-hiding port for future async; the **provider** is the async contract from day one.

### 19.5 Whole-window projection rule (**CERTIFIED**)

**Approved rule:**

When the CAA is queried for **one exact** civil-time window `(clubId, venueId?, date, startTime, endTime, …)` and reports `courtId ∈ availableCourtIds`, the bridge may attach **exactly one** absolute half-open interval:

```text
[resolvedWindowStartInstant, resolvedWindowEndInstant)
```

obtained by converting that **same** civil window with the certified IANA timezone. The projection is valid **only** as evidence for that exact queried window.

**Explicitly prohibited:**

- projecting outside the queried window;
- creating all-day or unrestricted intervals from CAA eligibility;
- deriving multiple intervals from one boolean answer;
- silently merging multi-call responses into one fake continuous interval;
- splitting intervals;
- querying a broad tournament day window and treating it as per-match evidence without whole-window certification for each match window;
- using `availableCourtIds` without matching echoed query metadata (`date`/`startTime`/`endTime`/`clubId`);
- projecting overnight / cross-midnight civil windows when CAA rejects them;
- treating empty `availabilityIntervals` + `AVAILABLE` as “CAA said unrestricted” — empty intervals remain a Phase 1B unrestricted semantics that **must not** be used for CAA-backed bridges.

### 19.6 Recommended query strategy (initial Phase 1D-B)

| Strategy | Correctness | Determinism | I/O | Booking semantics | Snapshot consistency |
|----------|-------------|-------------|-----|-------------------|----------------------|
| 1. One common window covering all matches | Over-conservative; can false-deny free courts | High | 1 call | Wrong granularity | Single snapshot — tempting but **unsafe** as per-match evidence |
| 2. Distinct windows grouped by identical match intervals | Correct per unique window | High if group key canonical | ≤ unique windows | Matches CAA whole-window truth | Multi-eligibility map keyed by window |
| 3. Each match independently | Correct | High | High (N calls) | Correct | Same as 2 with more duplicates |

**Recommended initial strategy: (2) — group matches by identical absolute `[scheduledStart, scheduledEnd)` (and thus identical civil window after conversion); one CAA query per group.**

Fail closed if any match cannot be expressed as a supported same-day civil window under the certified timezone.

### 19.7 Timezone and civil-time ownership

| Concern | Owner | Reuse |
|---------|-------|-------|
| IANA timezone validation | Orchestration input / CORE-12 `requireTimezone` + `civilTime.assertIanaTimezone` | `court-assignment/contracts/shared.js`, `domain/civilTime.js` |
| Civil `date`/`startTime`/`endTime` production | Orchestration (from absolute match times + timezone) | `absoluteToCivil*` / TE guard patterns **mirrored**, not imported from TE |
| Civil→instant conversion | Orchestration / bridge (not CAA) | `civilDateTimeToUtcMs` |
| DST invalid local time | Fail closed via civilTime conversion errors | `civilTime.js` |
| DST ambiguous local time | Fail closed / Venue civilTime policy — do not pick host-local | `CIVIL_TIME_ERROR.AMBIGUOUS_LOCAL_TIME` |
| Cross-midnight rejection | Bridge / orchestration | CAA same-day rule + CORE-12 civilWindow overnight reject |
| Machine-local independence | All layers | No `Date#getHours` host local; pin zone in tests |

**Fail closed in Phase 1D-B for:** cross-midnight match windows; overnight windows; match groups that cannot form a supported same-day CAA query. **Do not** silently split overnight windows without separate Owner authorization.

### 19.8 Snapshot and fingerprint semantics

Do **not** fabricate upstream snapshot identity.

| Concept | CAA supplies? | CORE-12 may derive? | Deterministic inputs | Persistence | Audit | Required? |
|---------|---------------|---------------------|----------------------|-------------|-------|-----------|
| `sourceSnapshotId` | **No** | **No** — omit or null; never UUID/time | — | Must not pretend Venue revision | Record absence | Optional; **null** if absent |
| `sourceSnapshotVersion` | **No** | **No** | — | Same | Record absence | Optional; **null** |
| `derivedAvailabilityFingerprint` | **No** | **Yes** — label **derived** | adapterContractVersion + queryFingerprint + sorted eligible ids + echoed civil window + club/venue | Local only | Yes | **Required** on eligibility snapshot |
| `adapterContractVersion` | **No** | **Yes** — pin constant e.g. `CORE12_CAA_ELIGIBILITY_BRIDGE_V1` | constant | Contract pin | Yes | **Required** |
| `queryFingerprint` | **No** | **Yes** — derived | clubId, venueId, date, startTime, endTime, courtIds, clusterId, context keys, timezone used for conversion | Local | Yes | **Required** |

Serialization for fingerprints must use CORE-12 canonical helpers (no host locale, no random, no timestamps).

`availabilitySnapshotRef` passed into Phase 1B must use **derived** fingerprint/version fields with explicit naming in metadata (e.g. `derived: true`, `sourceSnapshotId: null`).

### 19.9 Empty-result and error semantics

| Case | Bridge code (proposed) | Port/provider result | Invoke `assignCourtsDeterministic`? | Partial? | Committable? | Audit |
|------|------------------------|----------------------|-------------------------------------|----------|--------------|-------|
| 1. CAA success, `availableCourtIds: []` | `AVAILABILITY_EMPTY` | Valid **empty eligibility** snapshot (not unrestricted) | Only if matches empty; else assigner with **zero** intersected courts → conflicts / reject per policy | Default no | No (default) | Yes |
| 2. Only unavailable courts populated | Same as empty eligible | Empty eligibility (+ optional unavailable diagnostics) | Same | No | No | Yes |
| 3. Missing response / null | `AVAILABILITY_DATA_UNAVAILABLE` | **Error** (reject Promise) | **No** | No | No | Yes |
| 4. Malformed response | `AVAILABILITY_MALFORMED` | **Error** | **No** | No | No | Yes |
| 5. Upstream exception | `AVAILABILITY_DATA_UNAVAILABLE` | **Error** | **No** | No | No | Yes |
| 6. Timeout | `AVAILABILITY_TIMEOUT` | **Error** | **No** | No | No | Yes |
| 7. Scope rejection (club/venue) | Map CAA `CLUB_SCOPE_MISSING` / `VENUE_MISMATCH` | **Error** | **No** | No | No | Yes |
| 8. Invalid window | `INVALID_CIVIL_WINDOW` / `INVALID_TIME_WINDOW` | **Error** | **No** | No | No | Yes |
| 9. Unsupported overnight | `UNSUPPORTED_OVERNIGHT_WINDOW` | **Error** | **No** | No | No | Yes |

Valid empty eligibility ≠ unrestricted court set. Never encode CAA empty as Phase 1B empty-interval AVAILABLE courts.

### 19.10 CORE-11 boundary (explicit)

- CORE-11 has **no** approved public scheduled-match contract on main.
- Phase 1D-B **must not** claim direct CORE-11 production integration.
- Orchestration initially accepts **capability-local validated** `ScheduledMatchInput[]` (or an orchestration request factory that produces them).
- Any future CORE-11 adapter requires **separate** contract authorization.
- **Phase 1D scheduled-match TE/CC-09 anti-corruption adapter: DEFER** — not part of the smallest safe 1D-B; keep Phase 1C TE-compat isolated for parity only.

### 19.11 CORE-14 boundary (explicit)

- CORE-14 remains **deferred**; no calls in Phase 1D-B.
- **Inside Phase 1B:** in-request court time overlap among assignments in one `CourtAssignmentRequest`.
- **Future CORE-14:** cross-module / cross-resource / post-assignment validation, availability certification across producers — via published occupancy adapters only.

### 19.12 Dependency direction (corrected)

```text
Async orchestration (CORE-12 capability-local)
  → AvailabilitySnapshotProvider (injected)
       → getCompetitionCourtAvailability  (Venue & Court public export)
  → sync eligibility ∩ descriptors mapper
  → assignCourtsDeterministic (pure)
```

| Rule | Status |
|------|--------|
| Venue & Court must not import CORE-12 | Confirmed / required |
| No cycle | Confirmed under injection or one-way public import |
| No TE runtime dependency from CORE-12 | Confirmed |
| No direct repository / clubStorage / listCourts from CORE-12 | Confirmed |
| No Supabase from CORE-12 court-assignment | Confirmed |

**Repository architecture:** `docs/competition-engine/core-12/05_INTEGRATION_BOUNDARIES.md` requires Integrator-provided adapters for cross-module wiring and forbids deep Venue SSOT imports. Hard-coding `import { getCompetitionCourtAvailability } from '../../venue-court/index.js'` inside CORE-12 is **directionally acyclic** (TE already does this) but **not preferred** for CORE-12 purity.

**Recommended:** Integrator / host injects the CAA function into `AvailabilitySnapshotProvider`. Capability-local default factory for tests may bind the public export **only** behind the provider adapter file, never repositories.

### 19.13 Revised Phase 1D-B boundary

| Bucket | Work |
|--------|------|
| 1. CORE-12 can own now (after Owner authorizes 1D-B redesign) | Narrow eligibility port/mapper contracts; async provider interface; orchestration accepting capability-local matches + **caller court descriptors**; whole-window projection; derived fingerprints; fail-closed matrices; tests |
| 2. Requires Venue & Court authorization | OPTION A CAA descriptor extension / source snapshot ids / upstream absolute intervals — **not required** for Option C path |
| 3. Blocked by CORE-11 | Direct CORE-11 production scheduled-match integration |
| 4. Deferred to CORE-14 | Cross-module conflict resolution |
| 5. Production cutover | TE `assignCourts` / `runFullPlan` / UI — **forbidden** in 1D-B |

**1D-B readiness recommendation:**

`CORE12_PHASE_1D_B_REQUIRES_PORT_CONTRACT_REDESIGN`

(Smallest safe phase = Option C + Design 3 + query strategy 2; **not** “capability-local pretend CAA builds full courts”.)

### 19.14 Implementation blockers (A2)

| Blocker | Severity | Resolution path |
|---------|----------|-----------------|
| CAA insufficient for `AvailableCourtInput` alone | Hard for naive 1D-A plan | Option C + caller descriptors |
| Sync port overclaiming I/O / courts[] | Hard | Design 3 + port redesign |
| No upstream source snapshot identity | Medium | Derived fingerprint only; `sourceSnapshotId = null` |
| Overnight / cross-midnight unsupported | Product | Fail closed |
| CORE-11 public SM contract missing | Soft for 1D-B | Capability-local matches; defer ACA |
| Branch behind `origin/main` by 2 | Process | Rebase/sync before implementation PR (Owner) |

### 19.15 Revised proposed file scope (do not create in A2)

**CORE-12 (after 1D-B authorization):**

```text
src/features/competition-core/court-assignment/ports/availabilitySnapshotProvider.js
src/features/competition-core/court-assignment/ports/courtEligibilityPort.js          # narrowed rename/successor of CourtAvailabilityPort
src/features/competition-core/court-assignment/adapters/availability/
  createInjectedCompetitionEligibilityProvider.js
  projectWholeWindowEligibility.js
  intersectEligibleCourts.js
  index.js
src/features/competition-core/court-assignment/orchestration/
  assignCourtsFromCanonicalAvailability.js
  index.js
src/features/competition-core/court-assignment/contracts/
  eligibilitySnapshot.js
  orchestrationAvailabilityRequest.js
src/features/competition-core/court-assignment/constants/versions.js                 # add bridge/provider pins
src/features/competition-core/court-assignment/index.js                              # export orchestration + provider factories only as approved
tests/competition-core-court-assignment-core12-phase1d.test.js
docs/competition-engine/core-12/09_PHASE_1D_AVAILABILITY_WIRING.md                 # implementation record
```

**Outside CORE-12 (only if Owner later chooses OPTION A):**

```text
src/features/venue-court/adapters/competitionCourtAvailabilityAdapter.js   # extend response
docs/venue-court/*                                                          # contract docs
tests/venue-court/competition-court-availability-adapter.test.js
```

Mark Venue paths as **Venue & Court ownership** — not CORE-12.

### 19.16 Revised test matrix (additions for A2)

In addition to 1D-A §13 items 1–30, Phase 1D-B tests must cover:

1. Async provider behavior (`await loadEligibility`)
2. Rejected Promise / mapped bridge codes
3. Malformed upstream response
4. Exact whole-window projection only
5. No interval beyond the query
6. No invented court descriptor fields from IDs
7. `sourceSnapshotId` null vs `derivedAvailabilityFingerprint` present
8. Stable `queryFingerprint` across permutations of irrelevant input order
9. Same-day civil conversion correctness
10. Unsupported overnight fail-closed
11. Empty valid eligibility snapshot ≠ unrestricted courts
12. Missing upstream response
13. Stale / mismatched caller descriptor vs eligibility
14. Cross-venue descriptor ID rejected
15. Deterministic grouping of identical match windows
16. Repeated upstream queries for distinct groups (call count)
17. Input permutation invariance of final assignment fingerprint
18. Upstream call ordering deterministic by window key sort
19. No direct repository / clubStorage / listCourts import
20. No fabricated source snapshot ID / UUID / timestamp identity

### 19.17 A2 recommended verdicts

| Layer | Verdict |
|-------|---------|
| Document / design closure | `CORE_12_PHASE_1D_A2_CONTRACT_CLOSURE_READY_FOR_REVIEW` |
| CAA-alone sufficiency | `BLOCKED_UPSTREAM_COURT_DESCRIPTOR_CONTRACT` (finding; closed by Option C) |
| Next implementation readiness | `CORE12_PHASE_1D_B_REQUIRES_PORT_CONTRACT_REDESIGN` |
| Bridge architecture | **Option C** |
| Async model | **Design 3** |
| Query strategy | **Grouped identical match windows (strategy 2)** |
| Venue upstream work required for smallest 1D-B? | **No** (Option C). **Yes** only if Owner later selects Option A |

**Next Owner action:** Approve A2 closure (§19). Separately authorize Phase 1D-B **port redesign + injected eligibility provider** — still no TE cutover, no Venue source changes unless Option A is explicitly chosen.