# CORE-14 — Phase 1F Dormant Adapters and Shadow Parity

**Phase:** 1F
**Status:** Implemented, tested, dormant, and unwired
**Date:** 2026-07-22
**Authorization:** `AUTHORIZE_CORE_14_PHASE_1F_DORMANT_ADAPTERS_AND_SHADOW_PARITY`

---

## 1. Purpose

Phase 1F provides deterministic, capability-local boundary adapters, consumer report projectors, CC-09 compatibility mapping, and diagnostic-only shadow parity. It does not wire CORE-14 into production flows.

## 2. Ownership

CORE-14 owns translation into canonical resource occupancies and availability facts, shape-only projections, legacy-code interpretation, and parity diagnostics. It does not own source records, schedule generation, court/referee selection, optimizer evaluation, persistence, UI, or workflow application.

## 3. Dormant integration boundary

All public APIs remain under `src/features/competition-core/resource-conflict/`. `src/features/competition-core/index.js` remains unchanged and must not export this module. Integrators may call the capability-local barrel only after a separately approved wiring phase.

## 4. Source contract version

Every adapter request requires a non-empty `sourceContractVersion`. Missing versions and malformed record lists fail closed with `REJECTED_INVALID_INPUT`.

## 5. Schedule adapter

`adaptScheduleAssignmentsToResourceOccupancies` accepts caller records with an assignment/activity/match identity, player or team identities, and either explicit `startMs`/`endMs` or an explicitly supplied `slotResolver`.

It emits PLAYER, TEAM, and explicitly supplied LOCATION/VENUE occupancies only. It never derives a duration, infers scope from a record, generates a schedule, or resolves a slot without the caller resolver.

## 6. Court adapter

`adaptCourtAssignmentsToResourceOccupancies` accepts an explicit COURT `resourceKey` or `courtId` plus scope. It emits COURT occupancies only, performs no inventory lookup, and does not choose a court.

## 7. Referee adapter

`adaptRefereeAssignmentsToResourceOccupancies` accepts an explicit REFEREE `resourceKey` or `refereeId` plus scope. It emits REFEREE occupancies only, performs no roster lookup, and does not choose a referee.

## 8. Canonical occupancy output

Adapter output uses `ResourceOccupancy`, immutable canonical resource keys, safe-integer half-open intervals, deterministic occupancy IDs, source provenance, and preserved lock/published flags.

## 9. Duplicate integrity

Court and referee adapters, and the composite adapter, run duplicate-integrity validation. Duplicate output identities reject the result rather than silently coalescing or choosing a winner.

## 10. Partial adaptation

Mixed valid and invalid records may return completed output with diagnostics and `metadata.partialAdaptation=true`. If no usable record remains, the result is `REJECTED_INVALID_INPUT`.

## 11. Composite adapter

`combineResourceOccupancies` accepts independently supplied schedule, court, referee, and additional occupancy sets. It copies and deterministically sorts valid inputs, validates duplicate integrity, and explicitly records `detectorsExecuted=false`.

## 12. Availability adapter

`adaptAvailabilityAnswersToFacts` turns caller-supplied availability answers into normalized facts. It accepts canonical or `evaluated*` interval fields and preserves provider version/provenance.

## 13. Availability unknown policy

`UNKNOWN`, `DATA_UNAVAILABLE`, and `ERROR` source statuses are represented as CORE-14 `UNKNOWN`; none is treated as available. In AUTHORITATIVE mode unknown data produces `DATA_UNAVAILABLE`. In ADVISORY mode evaluation completes with PARTIAL availability certification.

## 14. Optimizer projector

`projectConflictResultForOptimizer` produces hard constraints, soft penalties, conflict keys, and caller-supplied local candidate moves. It assigns no weights, calculates no global score, and selects no recommendation.

## 15. Schedule projector

`projectConflictResultForSchedule` filters schedule-relevant findings and local recommendations. Its result is report-only and always declares `applied=false`.

## 16. Court projector

`projectConflictResultForCourtAssignment` filters court-relevant findings and court/time recommendations. It never enumerates inventory, selects a court, or applies a recommendation.

## 17. Referee projector

`projectConflictResultForRefereeAssignment` filters referee-relevant findings and referee/time recommendations. Referee overlap remains HARD, and the projector never selects or assigns a referee.

## 18. Legacy mapping

`mapLegacyConflictCodeToCore14` maps only semantics-equivalent CC-09 resource conflict codes. Insufficient-rest mapping requires explicit `MANDATORY` or `PREFERRED` rest mode. Workflow and unknown legacy codes remain unmapped with diagnostics.

`projectCore14FindingsToLegacy` is compatibility projection only; it does not alter CORE-14 findings or create a second source of truth.

## 19. Shadow parity

`compareLegacyAndCore14Conflicts` is diagnostic-only. It classifies evidence as `MATCHED`, `CORE14_ONLY`, `LEGACY_ONLY`, `SEMANTIC_MISMATCH`, `UNMAPPABLE_LEGACY_CODE`, or `INSUFFICIENT_LEGACY_EVIDENCE`.

Slot keys alone are not interval evidence. The result always retains `core14PlanStatusUnchanged=true` and `core14FindingsSuppressed=false`.

## 20. Determinism and immutability

Adapters and projectors canonicalize and sort output, provide deterministic fingerprints, avoid `Date.now` and `Math.random`, freeze output, and never mutate caller-owned input.

## 21. Explicit non-goals

Phase 1F contains no React/UI imports, Supabase/persistence, scheduling generation, court/referee selectors, optimizer evaluator imports, production availability adapters, root export, automatic application, SQL, CI-manifest changes, or production wiring.

## 22. Test and approval evidence

`tests/competition-core-resource-conflict-core14-phase1f.test.js` covers numbered cases 1–104:

- schedule, court, referee, composite, and availability adapter contracts;
- optimizer, schedule, court, and referee projections;
- legacy mappings and all shadow parity categories;
- deterministic fingerprints, rejected-input behavior, and mutation safety;
- architectural import/application boundaries; and
- markers for separate Phase 1C, 1D, 1E, and Phase 1F regression execution.

Run:

```bash
node --test tests/competition-core-resource-conflict-core14-phase1f.test.js
```

Passing this test suite certifies only the dormant Phase 1F capability boundary. It does not authorize integration, automatic conflict resolution, deployment, or changes to adjacent competition cores.

---

## 23. Adjacent contract audit (origin/main @ ad159870)

| Capability | On main? | Relevant path | Classification | Safe CORE-14 import? | Phase 1F approach |
|------------|----------|---------------|----------------|----------------------|-------------------|
| CORE-10 Optimizer | Yes | `src/features/competition-core/optimizer/` | Public contracts + substrate impl | Public contracts only; **not** evaluator | Shape-only projector |
| CORE-11 Schedule Engine (named) | No | — | Absent | N/A | Shape-only schedule adapter |
| CC-09 scheduling | Yes | `src/features/competition-core/scheduling/` | Contracts + validator | Constants yes; engines no | Local code mirror + mapping (no import) |
| CORE-12 Court Assignment (named) | No | TE `courtAssignmentEngine.js` | Tournament impl | **No** | Shape-only court adapter |
| CORE-13 Referee Assignment (named) | No | format `refereeAssignEngine.js` | Tournament/format impl | **No** | Shape-only referee adapter |
| Venue & Court availability | Yes | `src/features/venue-court/` + competition adapter | Public facade over Club V3 persistence | **No** (persistence chain) | Shape-only availability fact adapter |
| Competition Availability Adapter | Yes | `venue-court/adapters/competitionCourtAvailabilityAdapter.js` | Competition-facing adapter over persistence | **No** | Documented future Integrator port |

---

## 24. Direct-import safety matrix

| Import used by Phase 1F | Owner | Classification | Stability | Why safe | Local shape alternative |
|-------------------------|-------|----------------|-----------|----------|-------------------------|
| *(none adjacent)* | — | — | — | Phase 1F uses **zero** adjacent-module imports | All adapters/projectors/legacy mirrors are local |

Forbidden and verified absent: UI/React, Supabase/repos, tournament engines, schedule generators, court/referee selectors, optimizer evaluators, Venue persistence services, root `competition-core` export wiring.

---

## 25. Adapter diagnostics contract

| Code | Meaning | Prefer Phase 1C equivalent when exact |
|------|---------|---------------------------------------|
| `ADAPTER_RECORD_INVALID` | Non-object / malformed adapter envelope or record | New |
| `ADAPTER_SOURCE_VERSION_MISSING` | Missing `sourceContractVersion` | New |
| `LEGACY_CONFLICT_CODE_UNMAPPED` | Legacy code has no resource-conflict equivalent or rest policy unknown | New |
| `LEGACY_EVIDENCE_INSUFFICIENT` | Legacy conflict lacks interval evidence for parity | New |
| `ADJACENT_CONTRACT_UNAVAILABLE` | Reserved for future Integrator port failures | New (catalogued; unused in dormant path) |
| Identity / scope / interval / slot / kind | Emitted via existing Phase 1C codes | `RESOURCE_ID_MISSING`, `ACTIVITY_IDENTITY_MISSING`, `SCOPE_MISSING`, `TIME_WINDOW_MISSING`, `SLOT_RESOLUTION_FAILED`, `UNKNOWN_RESOURCE_TYPE`, `UNSUPPORTED_CANONICAL_VALUE`, `DUPLICATE_*` |

Conceptual brief labels such as `ADAPTER_IDENTITY_MISSING` map to the Phase 1C codes above — not duplicated.

---

## 26. AdapterResult V1

Frozen envelope (`core14-adapter-result-v1`):

`evaluationStatus`, `occupancies`, `normalizedAvailabilityFacts`, `projectedReport`, `diagnostics`, `inputRecordCount`, `outputRecordCount`, `rejectedRecordCount`, `sourceContractVersion`, `adapterContractVersion`, `deterministicFingerprint`, `metadata` (includes `partialAdaptation` when applicable).

Invalid required input never yields a certified successful empty-success without diagnostics. Rejected records are disclosed. Caller input is never mutated.

---

## 27. Deterministic adapter occupancy identity

`CORE14_OID_V1:<hex>` fingerprints:

`adapterContractVersion`, `sourceContractVersion`, canonical resource key, source record identity, activity identity, `startMs`/`endMs`, occupancy role.

Excluded: array index, input order, `Date.now`, `Math.random`, DB row order, locale sort. Reordered equivalent source input → identical occupancy IDs and adapter fingerprints.

---

## 28. Complexity

| Step | Bound |
|------|-------|
| Per-record adaptation | O(k) resources per record |
| Composite combine + sort | O(n log n) |
| Duplicate integrity | O(n log n) |
| Availability normalize/sort | O(f log f) |
| Projectors | O(F + R) findings/recommendations |
| Legacy map / shadow | O(L + F) |

No inventory search, no global optimization, no production port calls.

---

## 29. Deferred production wiring

Deferred to a separately authorized phase:

- Wiring CORE-10 / 11 / 12 / 13 callers
- Integrator-owned Availability Port over Venue & Court
- Automatic recommendation application
- Persistence / SQL / UI / routes / workflow
- Root `competition-core` export
- CI Integrator unit-test-files manifest inclusion
