# CORE-12 — Implementation Plan

**Phase:** 1A proposes; 1A-R remediated; 1A-S synced to `origin/main`; execution starts only with Owner authorization for Phase 1B+.  
**Synced HEAD / origin/main:** `ad159870b4b9541406cbc0b0c476836f551e03c5`  
**Phase 1A authoring tip (pre-sync):** `be99c1a6de5425814b98c923bdba734b231640da`  
**Note:** Incoming 1A-S upstream was CRM Phase 1H-B only. Phase 1B must still treat CORE-11 / CORE-14 public contracts as unavailable until present and stable on main.

**Naming:** CORE-11 = Schedule Engine · CORE-12 = Court Assignment · CORE-14 = Resource Conflict Resolver  
**Availability:** Venue & Court Competition Availability Adapter is mandatory (`getCompetitionCourtAvailability` or approved successor).

---

## 1. Phase map

| Phase | Goal | Code? | Gate |
|-------|------|-------|------|
| **1A / 1A-R** (this package) | Audit + domain + contracts + invariants + boundaries (remediated) | Docs only | Owner review |
| **1B** | Domain foundation — contracts, enums, pure assigner, ports, tests | Capability-local under `court-assignment/` | Architecture freeze sign-off |
| **1C** | Legacy TE `assignCourts` parity adapter + shadow compare | Adapters + tests | Parity report |
| **1D** | Wire `CourtAvailabilityPort` to Competition Availability Adapter + timezone certification | Port adapters | Fail-closed REQUIRED mode tests |
| **1E** | Rule port + conflict catalog completion | Integration | CORE-01 contract check |
| **1F** | Integrator certification / flag / non-root export policy | Docs + tests | No production default ON without Owner |

Production UI cutover, SQL, Supabase, Director runtime merge, **direct CORE-11 wiring**, and **CORE-14 Resource Conflict Resolver** integration are **explicitly later** and need separate Owner authorization.

---

## 2. Recommended Phase 1B scope (next)

### 2.1 Create (capability-local only)

```text
src/features/competition-core/court-assignment/
  contracts/
  enums/
  errors/
  services/assignCourtsDeterministic.js
  services/validateCourtAssignmentRequest.js
  services/detectCourtOverlaps.js
  deterministic/ordering.js
  ports/courtAssignmentPort.js
  ports/courtAvailabilityPort.js   # consumer-side only
  ports/courtAssignmentRulePort.js
  adapters/ (stubs / test doubles only in 1B)
  index.js
```

### 2.2 Implement

1. Strict `create*` factories for all Phase 1A contracts (capability-local DTOs).
2. Request validator covering all applicable Owner invariants (incl. timezone, duplicates, locks, unambiguous intervals).
3. Pure **deterministic greedy** assigner honoring locks, ordering, overlap, and snapshot `availabilityStatus` on **request-provided** `AvailableCourtInput[]` (availability port may be a fixed test double in 1B that still models Competition Availability Adapter semantics).
4. Status model `SUCCESS|PARTIAL|INFEASIBLE|REJECTED|ERROR`.
5. `resultFingerprint` over assignable material.
6. Unit tests covering **≥ 15 Owner invariant groups**, with **total tests > 15** where positive/negative edge cases are required — see `04_INVARIANTS_AND_CONFLICT_MODEL.md` §10.

### 2.3 Explicitly defer from 1B

- UI wiring (`EngineCourtsTab`, Director)
- Live Competition Availability Adapter production wiring (fixed port / doubles OK; real adapter in 1D)
- **CORE-10** optimizer integration (**not** a Phase 1B runtime dependency)
- Court Engine session mode / TE-CE inventory fallbacks
- Persistence / SQL
- Modifying TE `assignCourts` production path
- Root `competition-core/index.js` export
- **CORE-11** implementation or direct public-contract wiring (contract not final on main)
- **CORE-14** Resource Conflict Resolver integration
- Recreating generic cross-resource conflict resolution inside CORE-12

### 2.4 Files other cores — do not touch

No edits under `constraints/`, `match-generation/`, `optimizer/`, `seeding/`, `draw-runtime/`, `lineups/`, venue inventory / availability calculation services (except future read-only adapter files under CORE-12 `adapters/` that call the Competition Availability Adapter).

---

## 3. Algorithm baseline (1B)

**Greedy stable scan** (documented successor to TE `assignCourts`):

1. Validate request (capability-local DTOs; fail closed on non-representable intervals).
2. Partition matches: terminal skipped / bye / locked / assignable.
3. Validate locked set (overlap among locks + snapshot availability flags).
4. Sort assignable matches.
5. For each match, scan sorted courts; take first eligible.
6. Build result + fingerprint.

**CORE-10:** not required. Optional later global optimization must use an **explicit port/adapter**; CORE-12 remains canonical owner of assignment validity and result contracts.

---

## 4. Parity strategy (1C)

| Legacy input | Mapping |
|--------------|---------|
| TE EngineContext | `CourtAssignmentRequest` |
| `assignCourts` assignments | `AssignedCourtSlot` |
| conflict messages | canonical codes |

Shadow mode:

- Run legacy + CORE-12 on same fixtures
- Compare courtId per matchId where both assign
- Diff report for lock / unavailable / partial semantics (expect intentional divergences where legacy `ok` heuristic differs)

Availability for parity fixtures must still be modeled as Competition Availability Adapter snapshots — not TE/CE reconstructed inventory.

---

## 5. Test impact assessment

| Area | Impact |
|------|--------|
| New tests | `tests/competition-core-court-assignment-core12-phase1b.test.js` (name TBD) |
| Invariant coverage | **≥ 15 invariant groups**; **> 15 tests** with dedicated timezone, duplicate ID, lock conflict, partial-policy, and deterministic-ordering edge cases |
| Traceability | Every Owner-required invariant → one or more tests |
| Existing TE court tests | Untouched in 1B; referenced as fixtures only |
| Existing CE / venue tests | Untouched |
| Architecture boundary tests | Extend later to assert no root export / no cross-core deep imports / no CORE-10 runtime coupling |
| CI surface | Add only capability-local tests until Integrator updates manifests |

**Phase 1A / 1A-R:** no test code added.

---

## 6. Feature flag (future)

Suggested (Integrator-owned naming):  
`VITE_ENABLE_CORE12_COURT_ASSIGNMENT` default `false`.

No flag work in 1A/1B unless Owner requests.

---

## 7. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| CORE-11 public contract absent on main | Keep `ScheduledMatchInput` capability-local; anti-corruption adapter later; no hard-coded CORE-11 assumptions in 1B |
| TE still joint-packs courts | 1C parity strips/reassigns courts |
| Locale sort drift (`vi` vs default) | Pin comparatorVersion; avoid `"vi"` in certified path |
| Dual CE vs competition modes | Keep CE out of CORE-12 ownership and out of availability fallbacks |
| Civil vs absolute / overnight projection | Fail closed on unambiguous-interval failures; overnight policy owned upstream via Competition Availability Adapter |
| Accidental UI / TE / CE inventory coupling | Port purity tests; mandatory adapter-only availability |
| CORE-10 accidental runtime coupling | Phase 1B forbids optimizer imports; optional explicit port later |
| CORE-14 premature generic resolver | CORE-12 only in-request court overlaps; CORE-14 deferred |
| Scope contamination across cores | Docs-only 1A/1A-R; 1B path allowlist |

---

## 8. Owner decisions requested

1. Confirm courts-after-schedule (CORE-12) vs keeping joint time+court as long-term SSOT.
2. Confirm Daily Play Court Engine remains outside CORE-12.
3. Confirm default `partialAssignmentAllowed = false`.
4. Confirm capability matching default (`HARD` when match declares requirements).
5. Confirm comparator locale pinning (`en` / default).
6. Confirm Competition Availability Adapter remains the sole availability source (no TE/CE/UI fallback).
7. Authorize Phase 1B code under `court-assignment/` when ready.

---

## 9. Exit criteria for Phase 1A / 1A-R

- [x] Pre-flight safety recorded
- [x] Inventory of existing assigners / availability / schedule contracts
- [x] Domain model documented
- [x] Contracts and ports named
- [x] Invariants + conflict codes documented (**15** Owner invariant groups; test plan ≥ 15 groups / > 15 tests)
- [x] Integration boundaries documented (CORE-14 = Resource Conflict Resolver; CORE-11 provisional; adapter mandatory; CORE-10 non-runtime for 1B)
- [x] Overnight wording corrected (adapter capability + fail closed; not universal domain ban)
- [x] Implementation plan for 1B+
- [x] No production code, SQL, commits, or pushes
- [x] Phase 1A-S: fast-forward synced to `origin/main`; CRM upstream did not invalidate CORE-12 docs

**Verdict target:** `CORE_12_PHASE_1A_SYNCED_READY_FOR_APPROVAL`
