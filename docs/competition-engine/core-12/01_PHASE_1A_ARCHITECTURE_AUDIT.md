# CORE-12 Phase 1A — Architecture Audit

**Module:** Competition Court Assignment  
**Phase:** 1A — Architecture audit and contract design only (no production code)  
**Remediation:** 1A-R documentation corrections (2026-07-22)  
**Sync:** 1A-S fast-forward to `origin/main` `ad159870b4b9541406cbc0b0c476836f551e03c5` (CRM Phase 1H-B only; no CORE-12 architectural impact)  
**Branch:** `feature/competition-core-12-court-assignment`  
**Synced HEAD / origin/main:** `ad159870b4b9541406cbc0b0c476836f551e03c5`  
**Phase 1A authoring tip (pre-sync):** `be99c1a6de5425814b98c923bdba734b231640da`

---

## 1. Safety baseline (independently verified)

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Current working directory | **PASS** | `C:\Users\Le Phong\PICK_VN-Workstreams\competition-engine\competition-core-12-court-assignment` |
| 2 | Current branch | **PASS** | `feature/competition-core-12-court-assignment` |
| 3 | Current HEAD SHA | **PASS** | `be99c1a6de5425814b98c923bdba734b231640da` |
| 4 | Fresh `origin/main` after `git fetch origin main` | **PASS** | `be99c1a6de5425814b98c923bdba734b231640da` |
| 5 | Ahead / behind vs `origin/main` | **PASS** | `0	0` (not ahead, not behind) |
| 6 | Full git status | **PASS** | Clean working tree before docs |
| 7 | Existing Competition Core structure | **PASS** | `src/features/competition-core/` present; cores 01–10 docs/code present; **no** `core-11` / `core-12` code yet |
| 8 | Court / schedule / venue / optimizer adapters | **PASS** | Inventory in §4–§5 |
| 9 | Workspace clean at audit start | **PASS** | `git status --porcelain` empty |
| 10 | Safe to continue Phase 1A docs | **PASS** | Correct branch, clean tree, no scope contamination at start |

**Safety gate outcome:** Proceed with documentation only. No `BLOCKED_WRONG_BRANCH`, `BLOCKED_UNSAFE`, or `BLOCKED_SCOPE_CONTAMINATION` at audit start.

---

## 2. Audit scope

Limited to CORE-12 Court Assignment Phase 1A:

1. Existing court assignment implementations
2. Court availability sources
3. Venue and club scoping
4. Schedule Engine output contracts
5. Match duration and time-window models
6. Court capability / court-type constraints
7. Disabled, unavailable, maintenance, or blocked courts
8. Existing booking conflict logic
9. Tournament court allocation UI and services
10. Deterministic seed utilities
11. Global Optimizer integration points
12. Rule Engine constraints relevant to courts
13. Audit / event / idempotency conventions
14. Legacy duplicate or conflicting implementations
15. UTC / local-time / timezone risks

**Out of scope:** production implementation, SQL, Supabase changes, commits, PRs, deploys, and modifications to CORE-01…CORE-11 / CORE-13 / CORE-14 / Venue inventory implementation.

---

## 3. Executive findings

### 3.1 Canonical owner is vacant

Phase 3 migration matrix classifies court assignment as **NEEDS_CANONICAL_IMPLEMENTATION + NEEDS_OWNER_DECISION**. No `docs/competition-engine/core-12/` or `competition-core/court-assignment/` module existed before this Phase 1A package.

CORE-09 explicitly forbids `courtId` on `MatchPlan`.  
CORE-10 explicitly does **not** own court assignment.  
Historical `competition-core/scheduling/` is a CC-09 shadow/envelope — not a court assigner.

### 3.2 Three product surfaces currently assign courts

| Surface | Path | Model | Deterministic? |
|---------|------|-------|----------------|
| Tournament Engine calendar assigner | `tournament-engine/engines/courtAssignmentEngine.js` (`assignCourts`) | Post-schedule court bind on timed matches | Mostly stable sort; no CORE seed/fingerprint |
| Tournament Engine joint packer | `tournament-engine/engines/scheduleEngine.js` (`generateSchedule`) | **Time + court** in one pass | Stable ordering; timezone-aware ISO |
| Court Engine session auto-assign | `court-engine/engines/autoCourtAssignmentEngine.js` | Queue → empty court occupancy | **No** (`Date.now` / `Math.random` proposal ids) |
| Director runtime occupancy | `tournament/engines/courtEngine.js` (`assignMatchToCourt`) | Live one-match-per-court | Runtime / UI driven |

CORE-12 must own the **canonical competition calendar assignment** (timed matches → courts). Session Daily-Play and live Director occupancy remain legacy/adapters until Owner expands scope.

### 3.3 Schedule already embeds courts today

`generateSchedule` writes `courtId`, `slot`, `scheduledStart`, `scheduledEnd` together. That conflates future **CORE-11 Schedule Engine** (time) with **CORE-12 Court Assignment** (court). Phase 1A design separates them: CORE-12 consumes scheduled windows and does not invent match start times.

**CORE-11 status:** current `origin/main` does **not** contain the final CORE-11 implementation or public contract. `ScheduledMatchInput` is a **CORE-12 capability-local normalized DTO**, not a declared final CORE-11 public output. Direct CORE-11 wiring and hard-coded upstream assumptions are deferred until that contract is available on main; an anti-corruption / alignment adapter may be required.

### 3.4 Canonical availability ownership (Venue & Court)

The **Competition Availability Adapter** (`getCompetitionCourtAvailability`, or an Owner-approved canonical successor) is the **mandatory** availability source for Competition Core.

- CORE-12 must audit and reuse that adapter — it does **not** own court inventory, operating hours, maintenance state, booking state, or availability calculation.
- `CourtAvailabilityPort` is only a **consumer-side** boundary that projects adapter output into an immutable snapshot.
- `AvailableCourtInput` is only an immutable availability **snapshot DTO**, not owned inventory.
- **Forbidden fallbacks:** Tournament Engine reconstructed courts, Court Engine session inventory, UI stores, first venue, first club, or manually rebuilt court lists.

### 3.5 Highest architectural risks

1. Dual/triple assign paths (TE schedule, TE assignCourts, CE auto-assign, Director runtime).
2. Joint time+court ownership bleed into CORE-11.
3. Civil-time vs ISO timezone mismatch.
4. Non-deterministic CE proposal ids.
5. Silent partial success / first-court fallback patterns in legacy engines.
6. Missing court-type / capability hard constraints.
7. Manual lock override semantics inconsistent across surfaces.

---

## 4. Existing implementation inventory

### 4.1 Court assignment engines

| # | Implementation | Key exports | Role vs CORE-12 |
|---|----------------|-------------|-----------------|
| 1 | `src/features/tournament-engine/engines/courtAssignmentEngine.js` | `assignCourts`, `matchImportance`, `courtsByPriority` | Closest calendar assigner; **legacy reference**, not canonical |
| 2 | `src/features/tournament-engine/engines/scheduleEngine.js` | `generateSchedule` | Joint time+court packer; schedule concern primarily CORE-11 |
| 3 | `src/features/tournament-engine/orchestrator/tournamentEngine.js` | `runCourtAssignmentEngine`, `runScheduleEngine`, `runFullTournamentPlan` | Orchestration façade |
| 4 | `src/features/court-engine/engines/autoCourtAssignmentEngine.js` | `generateCourtAssignments`, `confirmAssignments` | Session Daily-Play; out of CORE-12 ownership |
| 5 | `src/tournament/engines/courtEngine.js` | `assignMatchToCourt`, `transferMatchToCourt`, `releaseCourt`, `canAssignMatchToCourt` | Live Director occupancy |
| 6 | `src/features/competition-core/scheduling/*` | `calculateCanonicalSchedule`, conflict validate | Shadow mapping only |
| 7 | `src/features/ai-assistant/engines/scheduleValidator.js` | court conflict checks | Advisory only |
| 8 | `src/features/competition-core/formation/adapters/formationCourtParity.js` | parity helpers | Formation slots ≠ venue courts |

### 4.2 Availability sources

| Source | Path | Notes |
|--------|------|-------|
| **Canonical Competition Availability Adapter (mandatory)** | `venue-court/adapters/competitionCourtAvailabilityAdapter.js` (`getCompetitionCourtAvailability`) | Sole approved Competition-facing availability surface; deterministic reshape; read-only |
| Venue availability evaluator (adapter-internal SSOT) | `venue-court/services/courtAvailabilityService.js` | Inventory + bookings + hours + master status — owned by Venue & Court, not CORE-12 |
| TE guard | `tournament-engine/services/competitionAvailabilityGuard.js` | Legacy TE consumer of venue availability — **not** a CORE-12 fallback source |
| CE guard | `court-engine/services/courtEngineAvailabilityGuard.js` | Session REQUIRED/LEGACY — **not** a CORE-12 fallback source |
| Booking overlap | `domain/courtBookingEngine.js` (`checkBookingConflict`) | Used inside Venue & Court evaluation |
| Tournament booking bridge | `domain/tournamentBookingService.js` | Calendar day-block → bookings (Integrator/venue concern) |

### 4.3 Venue / club scoping

- `venueCourtScopeService.assertClubVenueScope` — explicit `clubId` required; no first-club fallback.
- Availability requires club scope; optional `venueId` / `tenantId` validated against club.
- Cluster is a filter, not ownership.
- Glossary: Venue ≠ Club ≠ Court Cluster ≠ Court.

### 4.4 Schedule output contracts (upstream of CORE-12)

**TE `generateSchedule` result (legacy):**  
`{ ok, data: { matches, slotCount, minRestMinutes, estimatedEndTime }, warnings, explain }`  
Matches may carry `courtId`, `slot`, `session`, `scheduledStart`, `scheduledEnd`, `matchOrder`.

**CC scheduling envelope:**  
`SchedulingRequest` / `SchedulingAssignment` / `SchedulingResult` / `SchedulingConflict` in `schedulingTypes.js`.  
`SchedulingAssignment` already has optional `courtId` + time fields — useful mapping target, **not** CORE-12 ownership of scheduling.

**Provisional CORE-11 → CORE-12 handoff (design intent only):**  
When CORE-11’s public contract lands on main, CORE-12 expects scheduled matches with resolved start/end (absolute intervals + timezone), **without** requiring a court. Until then, CORE-12 normalizes inputs into capability-local `ScheduledMatchInput` DTOs and must not hard-code unsupported CORE-11 shapes.

### 4.5 Duration and time windows

| Layer | Fields | Constraint |
|-------|--------|------------|
| TE `scheduleConfig` | `averageMatchMinutes`, `bufferMinutes`, rest, sessions, `date`, `timezone` | Slot = duration + buffer |
| CE config | `defaultMatchMinutes` (~20), `estimatedEndAt` | Wall-clock estimates |
| CC `SchedulingConfiguration` | `matchDurationMinutes`, buffers, `timezone` | Typed envelope |
| Civil window (current Venue & Court capability) | `date` + `startTime`/`endTime` HH:mm | Current canonical adapter does **not** support overnight operating windows; CORE-12 fails closed on unambiguous-interval failures (does not own upstream overnight policy) |
| Tournament `courtSchedule` | day-block courtIds | Booking bridge, not per-match assign |

### 4.6 Court capability / type

- Inventory model supports `COURT_TYPES` (`indoor` \| `outdoor` \| `covered`).
- Current assigners **do not** hard-filter by court type.
- Soft: `court.availableSessions`, `court.priority`, unlocked preference.
- CORE-12 contracts must support optional capability constraints without inventing inventory.

### 4.7 Disabled / unavailable / maintenance

| Layer | Mechanism |
|-------|-----------|
| Master inventory | `active`, `locked`, `maintenance` |
| Availability reasons | `COURT_INACTIVE`, `COURT_LOCKED`, `COURT_MAINTENANCE`, booking conflicts, outside hours |
| TE | Filter `court.locked`; availability checker |
| CE runtime | `LOCKED` / `MAINTENANCE` / busy assignment statuses |
| Director | `COURT_STATUS.LOCKED`, `lockedCourtIds` |

### 4.8 Booking / overlap conflict logic

- Domain booking overlap (`checkBookingConflict`).
- TE `timeOverlaps` on ISO intervals (match vs match on same court).
- CC `validateSchedulingConflicts` → `COURT_TIME_CONFLICT`, `COURT_UNAVAILABLE`, etc. (post-hoc).
- AI advisory `court_conflict`.

**Gap:** TE overlap uses absolute `Date` parsing — correct only when ISO includes proper offsets. Civil-only strings without timezone are a risk.

### 4.9 UI and services (consumers, not owners)

| UI / service | Path |
|--------------|------|
| Engine Courts tab | `pages/tournament/engine/tabs/EngineCourtsTab.jsx` |
| Court schedule panel / manager | `components/tournament/TournamentCourtSchedule*.jsx` |
| Director board / actions | `DirectorCourtBoard.jsx`, `useDirectorActions.handleAssignCourt` |
| TE hook | `useTournamentEngine.assignCourtsAuto` |
| Court Management booking UI | `pages/courtManagement/**` (inventory ops) |

### 4.10 Deterministic seed utilities (reusable patterns)

| Utility | Path |
|---------|------|
| CORE-10 Mulberry32 | `optimizer/deterministic/seededRandom.js` |
| Draw / seeding Mulberry32 | `draw-runtime/services/deterministicRandom.js`, `seeding/services/deterministicRandom.js` |
| Lineup deterministic port | lineups ports |
| Fingerprints / freeze factories | CORE-09 / CORE-10 contract style |

Court assigners today are **not** seed/fingerprint certified.

### 4.11 CORE-10 Global Optimizer

- Owns generic `DecisionVariable` / scoring / replay substrate.
- Explicit non-ownership of court assignment **or** court availability.
- **Not** a runtime dependency of the Phase 1B deterministic greedy assigner.
- Future global optimization must use an **explicit port/adapter**; CORE-12 remains the canonical owner of court-assignment validity and result contracts.
- Fingerprint / freeze / PRNG **patterns** may be mirrored capability-locally — that is pattern reuse, not a CORE-10 runtime import.

### 4.12 CORE-01 Rule Engine

- Operation namespace includes `COURT_ASSIGNMENT` and `SCHEDULE`.
- Existing constraints lean player-centric (`MIN_REST_TIME`, `PLAYER_NOT_BUSY`, `AVAILABILITY_REQUIRED`).
- No dedicated hard rule type for court-inventory double-booking or court-type match.
- CORE-12 should consume evaluated rules via a **port**, not embed a second rule engine.

### 4.13 Audit / event / idempotency conventions

| Pattern | Source | Applicability |
|---------|--------|---------------|
| Request/result fingerprints | CORE-09 / CORE-10 | Adopt |
| Replay metadata excluding wall-clock | CORE-10 | Adopt for certified runs |
| Idempotency keys + audit port | CORE-06 lineups | Adopt for persist later |
| CE `eventLogService` random ids | Court Engine | **Do not** reuse as canonical |
| Scheduling audit with `Date.now` traces | CC scheduling | Not replay-certified |

### 4.14 Legacy duplicates / conflicts

1. Two schedule engines (`tournament/engines/scheduleEngine.js` vs TE feature scheduleEngine).
2. Two court engines (Director `courtEngine` vs feature `court-engine`).
3. Two/three assign paths (schedule-inline, `assignCourts`, CE generate).
4. Two availability guards (TE vs CE) over one venue SSOT.
5. Multiple status vocabularies (master vs CE runtime vs tournament `COURT_STATUS`).
6. Formation “courts” vs venue courts.

### 4.15 Timezone and operating-window risks

1. TE requires IANA venue timezone for ISO mint/parse (`TIMEZONE_REQUIRED`).
2. Venue availability is **civil-window** — no timezone conversion inside the Competition Availability Adapter.
3. Current canonical Venue & Court availability does **not** support overnight operating windows; CORE-12 must fail closed when an input interval cannot be represented unambiguously, without inventing overnight policy.
4. Future upstream overnight support must arrive through the canonical adapter — CORE-12 must not recreate availability logic.
5. CE estimates use host `Date.now()`.
6. CC scheduling traces use wall-clock ids/timestamps.
7. Mixing civil HH:mm with naive `new Date(iso)` without offset.

---

## 5. Competition Core structure (relevant)

```text
src/features/competition-core/
  constraints/           ← CORE-01
  participants/          ← CORE-02
  registration-eligibility/ ← CORE-03
  classification/        ← CORE-04
  teams/                 ← CORE-05
  lineups/               ← CORE-06
  seeding/ + seed/       ← CORE-07
  draw/ + draw-runtime/  ← CORE-08
  match-generation/      ← CORE-09
  optimizer/             ← CORE-10 (generic optimizer; not court assignment)
  scheduling/            ← historical CC-09 envelope (NOT CORE-12)
  matches/               ← match runtime (not CORE-14; Match Lifecycle is outside CORE-12/14 numbering here)
  …                      ← no court-assignment/ yet
```

**Proposed future namespace (Phase 1B+):**  
`src/features/competition-core/court-assignment/` — capability-local; root `competition-core/index.js` remains Integrator-owned.

**Docs:** `docs/competition-engine/core-02` … `core-10` exist. **`core-11` and `core-12` did not exist** before this package. **CORE-11 Schedule Engine** has no final public contract on current `origin/main` — treat as planned upstream; Phase 1B must not hard-wire unsupported CORE-11 assumptions. **CORE-14** is **Resource Conflict Resolver** (deferred; optional), not Match Lifecycle.

---

## 6. Reusable components (do not rewrite)

| Component | Reuse mode |
|-----------|------------|
| **Competition Availability Adapter** (`getCompetitionCourtAvailability`) | **Mandatory** canonical availability source (read-only); via consumer `CourtAvailabilityPort` |
| Civil-time helpers (`domain/civilTime.js`) | Shared utility via explicit timezone inputs |
| Club/venue scope asserts | Scope validation patterns |
| CORE-09/10 `create*` + freeze + fingerprint style | Contract factory **pattern** only (not CORE-10 runtime) |
| Seeded PRNG pattern | Optional tie-break / shuffle — capability-local copy; Phase 1B greedy assigner needs no CORE-10 import |
| CC `SchedulingAssignment` field names | Mapping compatibility only |
| TE `assignCourts` algorithm ideas | Reference for greedy baseline; not imported as SSOT or availability source |

---

## 7. What CORE-12 must not absorb

- Match generation / MatchPlan fields (CORE-09)
- Schedule time invention / rest packing ownership (**CORE-11 Schedule Engine** — deferred until public contract on main)
- Referee assignment (CORE-13)
- Generic cross-resource conflict resolution (**CORE-14 Resource Conflict Resolver** — deferred/optional; CORE-12 only prevents overlapping court allocations **inside** its own request)
- Match lifecycle / score status machines (match runtime / product — **not** CORE-14)
- Court inventory, operating hours, maintenance/booking state, or availability calculation (Venue & Court)
- Global optimization policy substrate (**CORE-10** — not a Phase 1B runtime dependency)
- UI stores / React hooks / TE-CE reconstructed inventory as engine inputs or fallbacks

---

## 8. Phase 1A deliverables in this package

| File | Purpose |
|------|---------|
| `01_PHASE_1A_ARCHITECTURE_AUDIT.md` | This audit |
| `02_COURT_ASSIGNMENT_DOMAIN_MODEL.md` | Canonical domain model |
| `03_COURT_ASSIGNMENT_CONTRACTS.md` | Public contracts and ports |
| `04_INVARIANTS_AND_CONFLICT_MODEL.md` | Invariants + conflict codes |
| `05_INTEGRATION_BOUNDARIES.md` | Sibling CORE / adapter boundaries |
| `06_IMPLEMENTATION_PLAN.md` | Phase 1B+ plan |

---

## 9. Audit verdict

**Architecture discovery complete.** Canonical CORE-12 ownership is clear and currently vacant. Legacy assigners are inventoried with explicit reuse vs replace guidance. Contracts and invariants are specified in sibling docs.

**Phase 1A / 1A-R / 1A-S status:** Documentation remediated, fast-forward synced to current `origin/main`, and ready for Owner approval — verdict `CORE_12_PHASE_1A_SYNCED_READY_FOR_APPROVAL`.
