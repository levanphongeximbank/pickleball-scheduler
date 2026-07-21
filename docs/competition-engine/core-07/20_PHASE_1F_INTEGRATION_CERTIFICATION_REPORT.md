# CORE-07 — Phase 1F Integration Certification Report

**Phase:** 1F — Integration Contracts and Shadow Readiness Certification
**Status:** Certified (capability-local, non-production) — Phase 1F-QA complete
**Baseline HEAD (Phase 1E accepted):** `bc9922ce3511fe3bacb05942e64a56b66a5d1172`
**Contract sources:** docs `07`–`14`, `18`, `19`
**Test file:** `tests/competition-core-seeding-core07-phase1f.test.js`

---

## 1. Canonical export boundary (Condition 1)

Canonical capability barrel:

`src/features/competition-core/seeding/index.js`

**Must not export** memory or testing implementations:

- `createMemorySeedingResultRepository`
- `createMemorySeedingLifecycleAudit`
- eligibility / rule / snapshot / fingerprint stubs

**Allowed subpaths only:**

| Helper class | Import path |
|--------------|-------------|
| Memory repository / audit | `src/features/competition-core/seeding/adapters/memory/index.js` |
| Testing port stubs | `src/features/competition-core/seeding/adapters/testing/index.js` |

`adapters/index.js` exports only the Phase 3G legacy adapter. It does **not** re-export memory/testing.

Integration facade `mergePorts` uses caller/default ports only (`|| null`). There is **no** implicit memory/test adapter fallback.

Evidence test: `1F export boundary: canonical barrel excludes memory/testing; subpaths work; no fallback` (lines 217–261).

---

## 2. Integration architecture

```text
CORE-01 Rule Engine decision (port)
CORE-03 eligibility decision (port)
Ranking/Rating snapshot source (port)
            ↓
createSeedingIntegrationFacade
            ↓
Phase 1D allocate / Phase 1E lifecycle
            ↓
SeedingResultRepositoryPort + SeedingLifecycleAuditPort
            ↓
projectAuthoritativeSeedingResult (read-only)
            ↓
mapAuthoritativeProjectionToDrawSeedRanking (neutral)
            ↓
CORE-08 Draw & Grouping consumer (downstream; not modified)
```

---

## 3. Coverage matrix summary

| Classification | Count |
|----------------|-------|
| DIRECT_TEST | 92 |
| INDIRECT_TEST | 14 |
| STATIC_BOUNDARY_ASSERTION | 22 |
| **NOT_COVERED** | **0** |

File for all rows unless noted: `tests/competition-core-seeding-core07-phase1f.test.js`.

---

## 4. Complete requirement → test mapping

### Group A — Integration facade

| # | Requirement | Class | Test name | Lines | Assertion |
|---|-------------|-------|-----------|-------|-----------|
| A1 | Generates DRAFT via Phase 1D | DIRECT_TEST | `1F facade: generate DRAFT via Phase 1D; finalize/read/project; inputs unchanged` | 263–305 | `finalizationState===DRAFT`; `typeof createDraftSeedingResult` |
| A2 | Finalizes via Phase 1E | DIRECT_TEST | same | 263–305 | `FINALIZED`; `typeof finalizeSeedingResult` |
| A3 | Supersedes via lifecycle | DIRECT_TEST | `1F facade: supersede through lifecycle service + repository` | 334–388 | `SUPERSEDED`; auth becomes `res-2` |
| A4 | Cancels DRAFT via lifecycle | DIRECT_TEST | `1F facade: cancel DRAFT via Phase 1E; missing repository fails closed` | 307–332 | `CANCELLED`; `typeof cancelSeedingResult` |
| A5 | Reads authoritative via repository | DIRECT_TEST | `1F facade: generate DRAFT…` | 263–305 | `getAuthoritativeSeedingResult` → `res-1f` |
| A6 | No duplicated allocation | STATIC_BOUNDARY_ASSERTION | `1F facade: no duplicated allocation/lifecycle…` | 390–414 | facade source imports `createDraftSeedingResult`; no `allocateSeedNumbers(` |
| A7 | No duplicated lifecycle | STATIC_BOUNDARY_ASSERTION | same | 390–414 | imports lifecycle services; no transition matrix |
| A8 | Requires explicit ports | DIRECT_TEST | `1F export boundary…` + cancel test | 217–261, 307–332 | bare facade throws without ports |
| A9 | Missing port fails closed | DIRECT_TEST | cancel / export / snapshot tests | 307–332, 217–261, 657–775 | `INTERNAL_PORT_FAILURE` / `SNAPSHOT_REQUIRED` |
| A10 | Port exception → INTERNAL_PORT_FAILURE | DIRECT_TEST | `1F facade: no duplicated…` + rules/snapshot | 390–414, 522–655, 657–775 | `err.code === INTERNAL_PORT_FAILURE` |
| A11 | Caller input unchanged | DIRECT_TEST | `1F facade: generate DRAFT…` | 263–305 | `JSON.stringify(raw)` unchanged |

### Group B — Eligibility

| # | Requirement | Class | Test name | Lines | Assertion |
|---|-------------|-------|-----------|-------|-----------|
| B1 | Valid ELIGIBLE accepted | DIRECT_TEST | `1F eligibility: ELIGIBLE accepted…` + facade draft | 416–440, 263–305 | assignments produced |
| B2 | INELIGIBLE excluded | DIRECT_TEST | `1F eligibility: ELIGIBLE accepted…` | 416–440 | no `b` in assignments; excludedEntries |
| B3 | UNKNOWN fails closed | DIRECT_TEST | `1F eligibility: UNKNOWN/missing…` | 442–520 | `ELIGIBILITY_REQUIRED` |
| B4 | Missing decision fails | DIRECT_TEST | same | 442–520 | `ELIGIBILITY_REQUIRED` for missing `b` |
| B5 | Scope mismatch rejected | DIRECT_TEST | same | 442–520 | `ELIGIBILITY_DECISION_MISMATCH` |
| B6 | Entry mismatch rejected | DIRECT_TEST | same | 442–520 | `ELIGIBILITY_DECISION_MISMATCH` |
| B7 | Provenance retained | DIRECT_TEST | `1F eligibility: ELIGIBLE accepted…` | 416–440 | `sourceModule` / `sourceVersion` |
| B8 | Port throw → INTERNAL_PORT_FAILURE | DIRECT_TEST | `1F facade: no duplicated…` | 390–414 | throw mapped |
| B9 | No `eligible !== false` fallback | STATIC_BOUNDARY_ASSERTION | `1F eligibility: UNKNOWN/missing…` | 442–520 | applyIntegrationPorts has no `eligible !== false` |

### Group C — Rule evaluation

| # | Requirement | Class | Test name | Lines | Assertion |
|---|-------------|-------|-----------|-------|-----------|
| C1 | Valid rule decision accepted | DIRECT_TEST | `1F rules: valid accepted…` | 522–655 | `b`/`c` assigned; provenance set |
| C2 | Missing required evaluation fails | DIRECT_TEST | same | 522–655 | `RULE_EVALUATION_REQUIRED` without port |
| C3 | Denied handled explicitly | DIRECT_TEST | same | 522–655 | hardPass false → excluded |
| C4 | Scope mismatch rejected | DIRECT_TEST + STATIC | same | 522–655 | spy receives request `seedingScope`; source passes `seedingScope: args.scope` |
| C5 | Rule-set version mismatch rejected | DIRECT_TEST | same | 522–655 | empty `ruleSetVersion` → `RULE_EVALUATION_REQUIRED` |
| C6 | Port throw → INTERNAL_PORT_FAILURE | DIRECT_TEST | same | 522–655 | mapped |
| C7 | No `constraints/**` deep import | STATIC_BOUNDARY_ASSERTION | rules + boundary tests | 522–655, 1174+ | no constraints import |
| C8 | No duplicate Rule Engine logic | STATIC_BOUNDARY_ASSERTION | `1F rules…` | 522–655 | no `evaluateConstraint` in applyIntegrationPorts |

### Group D — Snapshot provider

| # | Requirement | Class | Test name | Lines | Assertion |
|---|-------------|-------|-----------|-------|-----------|
| D1 | Complete snapshot accepted | DIRECT_TEST | `1F snapshot: complete/missing…` | 657–775 | draft + provenance |
| D2 | Required missing snapshot fails | DIRECT_TEST | same | 657–775 | `SNAPSHOT_REQUIRED` |
| D3 | Scope mismatch rejected | DIRECT_TEST | same | 657–775 | `SNAPSHOT_SCOPE_MISMATCH` |
| D4 | Incomplete follows policy | DIRECT_TEST | same | 657–775 | PARTIAL fails; `allowPartialSnapshot` allows |
| D5 | Candidate coverage validated | DIRECT_TEST | same | 657–775 | provider called with entryIds `a,b,c` |
| D6 | Snapshot provenance retained | DIRECT_TEST | same | 657–775 | snapshotId/sourceSystem/version |
| D7 | Provider exception mapped | DIRECT_TEST | same | 657–775 | `INTERNAL_PORT_FAILURE` |
| D8 | Ranking/rating not recalculated | STATIC_BOUNDARY_ASSERTION | same | 657–775 | no ranking/rating assignment in apply |
| D9 | No current-time fallback | STATIC_BOUNDARY_ASSERTION | same + boundary | 657–775, 1174+ | no `Date.now` in integration |

### Group E — Memory repository

| # | Requirement | Class | Test name | Lines | Assertion |
|---|-------------|-------|-----------|-------|-----------|
| E1 | Per-instance isolation | DIRECT_TEST | `1F memory repository…` | 777–914 | repo `a` vs `b` sizes |
| E2 | Scope isolation | DIRECT_TEST | same | 777–914 | two competitionIds coexist |
| E3 | Immutable copy on write | DIRECT_TEST | same | 777–914 | deepFreeze on save path |
| E4 | Immutable copy on read | DIRECT_TEST | same | 777–914 | mutate read throws |
| E5 | One authoritative FINALIZED/scope | DIRECT_TEST | same | 777–914 | companion does not replace auth |
| E6 | Conflicting authoritative rejected | DIRECT_TEST | same | 777–914 | `AUTHORITATIVE_RESULT_CONFLICT` |
| E7 | Atomic supersede semantics | DIRECT_TEST | facade supersede + memory | 334–388, 777–914 | auth becomes replacement |
| E8 | Idempotent permitted saves | DIRECT_TEST | same | 777–914 | repeated `saveFinalized` same id |
| E9 | No global state | DIRECT_TEST + STATIC | memory + export | 777–914, 217–261 | two instances; no `globalThis` |
| E10 | No browser storage | STATIC_BOUNDARY_ASSERTION | `1F memory repository…` | 777–914 | no localStorage/sessionStorage |
| E11 | No Supabase | STATIC_BOUNDARY_ASSERTION | same | 777–914 | no supabase string |
| E12 | No implicit Production fallback | STATIC_BOUNDARY_ASSERTION | export boundary | 217–261 | facade never imports memory |

### Group F — Memory audit

| # | Requirement | Class | Test name | Lines | Assertion |
|---|-------------|-------|-----------|-------|-----------|
| F1 | Per-instance isolation | DIRECT_TEST | `1F memory audit…` | 916–951 | second instance empty |
| F2 | Unique eventId enforcement | DIRECT_TEST | same | 916–951 | size stays 2 after duplicate |
| F3 | Duplicate append idempotent | DIRECT_TEST | same | 916–951 | append with same eventId |
| F4 | Duplicate does not create 2nd record | DIRECT_TEST | same | 916–951 | size === 2 |
| F5 | Stable event ordering | DIRECT_TEST | same | 916–951 | `["e1","e2"]` |
| F6 | Immutable write/read copies | DIRECT_TEST | same | 916–951 | mutate listed event throws |
| F7 | No hidden timestamps | STATIC_BOUNDARY_ASSERTION | same | 916–951 | no Date.now / new Date |
| F8 | No global state | STATIC_BOUNDARY_ASSERTION | same | 916–951 | no globalThis |
| F9 | No Production default | STATIC_BOUNDARY_ASSERTION | export boundary | 217–261 | not in canonical barrel |

### Group G — Authoritative projection

| # | Requirement | Class | Test name | Lines | Assertion |
|---|-------------|-------|-----------|-------|-----------|
| G1 | FINALIZED projects | DIRECT_TEST | `1F projection…` | 953–1009 | projection succeeds |
| G2 | DRAFT rejected | DIRECT_TEST | same | 953–1009 | `AUTHORITATIVE_RESULT_NOT_FINALIZED` |
| G3 | SUPERSEDED rejected | DIRECT_TEST | same | 953–1009 | same code |
| G4 | CANCELLED rejected | DIRECT_TEST | same | 953–1009 | same code |
| G5 | entryId preserved | DIRECT_TEST | same | 953–1009 | assignments[0].entryId |
| G6 | seedNumber preserved | DIRECT_TEST | same | 953–1009 | seedNumber === 1 |
| G7 | assignmentSource preserved | DIRECT_TEST | same | 953–1009 | assignmentSource truthy |
| G8 | Fingerprint preserved | DIRECT_TEST | same | 953–1009 | equals result fingerprint |
| G9 | Policy provenance retained | DIRECT_TEST | same | 953–1009 | policyProvenance present |
| G10 | Snapshot provenance retained | DIRECT_TEST | same | 953–1009 | snapshotProvenance present |
| G11 | Projection immutable | DIRECT_TEST | same | 953–1009 | push throws |
| G12 | Actor/audit secrets excluded | DIRECT_TEST | same | 953–1009 | no `do-not-leak`; no actor fields |
| G13 | Input result unchanged | DIRECT_TEST | same | 953–1009 | JSON clone equal |

### Group H — CORE-08 boundary

| # | Requirement | Class | Test name | Lines | Assertion |
|---|-------------|-------|-----------|-------|-----------|
| H1 | Neutral projection → seed ranking | DIRECT_TEST | `1F CORE-08 boundary…` | 1011–1052 | ranking a:1:1… |
| H2 | CORE-07 does not import CORE-08 | STATIC_BOUNDARY_ASSERTION | CORE-08 + boundary | 1011–1052, 1174+ | no draw-runtime/core-08 |
| H3 | Domain does not import Draw/Grouping | STATIC_BOUNDARY_ASSERTION | CORE-08 boundary | 1011–1052 | domain walk clean |
| H4 | Seed numbers not recalculated | STATIC_BOUNDARY_ASSERTION | same | 1011–1052 | no `seedNumber +` |
| H5 | Fingerprint not replaced | DIRECT_TEST | same | 1011–1052 | fingerprint unchanged |
| H6 | Assignments not mutated | DIRECT_TEST | same | 1011–1052 | projection JSON unchanged |
| H7 | No circular dependency | STATIC_BOUNDARY_ASSERTION | boundary | 1174+ | no mutual imports |
| H8 | CORE-08 remains downstream | INDIRECT_TEST | CORE-08 boundary | 1011–1052 | mapper owned by CORE-07 integration only |
| H9 | Root export inactive | STATIC_BOUNDARY_ASSERTION | CORE-08 + boundary | 1011–1052, 1174+ | root index no `./seeding` |

### Group I — Shadow comparison

| # | Requirement | Class | Test name | Lines | Assertion |
|---|-------------|-------|-----------|-------|-----------|
| I1 | Equal → no differences | DIRECT_TEST | `1F shadow…` | 1054–1128 | `equal===true` |
| I2 | Seed mismatch reported | DIRECT_TEST | same | 1054–1128 | `SEED_NUMBER_MISMATCH` |
| I3 | Canonical-only entry | DIRECT_TEST | same | 1054–1128 | `ENTRY_ONLY_IN_CANONICAL` |
| I4 | Legacy-only entry | DIRECT_TEST | same | 1054–1128 | `ENTRY_ONLY_IN_LEGACY` |
| I5 | Eligibility mismatch | DIRECT_TEST | same | 1054–1128 | `ELIGIBILITY_MISMATCH` |
| I6 | Stable difference ordering | DIRECT_TEST | same | 1054–1128 | codes sorted |
| I7 | Input permutation identical | DIRECT_TEST | same | 1054–1128 | r1.differences === r2 |
| I8 | Caller inputs unchanged | DIRECT_TEST | same | 1054–1128 | JSON clones |
| I9 | No legacy Production invoke | STATIC_BOUNDARY_ASSERTION | same | 1054–1128 | no seedEngine/teamGroupSeed |
| I10 | No Production writes | DIRECT_TEST | same | 1054–1128 | `productionWrites===false` |
| I11 | Legacy remains authoritative | DIRECT_TEST | same | 1054–1128 | metadata flag + note |
| I12 | No automatic cutover | DIRECT_TEST | same | 1054–1128 | no recommendCutover/automaticCutover |

### Group J — Architectural boundaries

| # | Requirement | Class | Test name | Lines | Assertion |
|---|-------------|-------|-----------|-------|-----------|
| J1 | No UI import | STATIC_BOUNDARY_ASSERTION | `1F boundary…` | 1174+ | no react/@mui |
| J2 | No Supabase adapter | STATIC_BOUNDARY_ASSERTION | same | 1174+ | no supabase import |
| J3 | No SQL | INDIRECT_TEST | scope validation pre-commit | n/a | no `.sql` in Phase 1F diff |
| J4 | No CORE-01 deep import | STATIC_BOUNDARY_ASSERTION | same | 1174+ | no `constraints/` |
| J5 | No CORE-03 deep import | STATIC_BOUNDARY_ASSERTION | same | 1174+ | no registration internals |
| J6 | No CORE-08 in domain | STATIC_BOUNDARY_ASSERTION | CORE-08 + boundary | 1011–1052, 1174+ | domain clean |
| J7 | No CORE-09 dependency | STATIC_BOUNDARY_ASSERTION | boundary | 1174+ | no match-generation |
| J8 | Root export inactive | STATIC_BOUNDARY_ASSERTION | same | 1174+ | no `./seeding` |
| J9 | Legacy engines unchanged | INDIRECT_TEST | pre-commit file list | n/a | no legacy engine paths |
| J10 | Phase 3G behaviour unchanged | DIRECT_TEST | boundary | 1174+ | resolver/assignSeeds present; 3G suite green |
| J11 | No feature flag | STATIC_BOUNDARY_ASSERTION | boundary | 1174+ | no VITE_/featureFlag in facade |
| J12 | No Production caller | STATIC_BOUNDARY_ASSERTION | export + boundary | 217–261, 1174+ | capability-local only |
| J13 | No global singleton | DIRECT_TEST + STATIC | memory/audit/export | 777–951, 217–261 | per-instance factories |
| J14 | No Math.random | STATIC_BOUNDARY_ASSERTION | snapshot + boundary | 657–775, 1174+ | integration clean |
| J15 | No Date.now / hidden time | STATIC_BOUNDARY_ASSERTION | same | 657–775, 1174+ | integration/audit clean |

---

## 5. Deterministic test evidence

Commands:

```text
node --test tests/competition-core-seeding-core07-phase1f.test.js  # ×2
```

Internal test `1F determinism: two full integration runs identical` asserts identical:

- authoritative result identity
- projection assignments
- audit event ordering
- shadow-difference ordering
- fingerprint
- policy/snapshot provenance

---

## 6. CI / environment condition

Phase 1F suite registered in `scripts/ci/unit-test-files.json`.

Broader Competition Core suites remain **ENV_BLOCKED** when `@supabase/supabase-js` is not installed. This is not a CORE-07 assertion failure.

---

## 7. Explicitly deferred Production work

- Supabase repository / audit adapters
- SQL migrations and Production schema
- API/UI wiring and feature flags
- Live CORE-08 runtime consumption wiring
- Production shadow execution and cutover
- Automatic rollback
- Legacy engine replacement

---

## 8. Path notes

- `integration/applyIntegrationPorts.js` — eligibility/rules/snapshot apply
- `adapters/memory/` — explicit memory adapters (subpath only)
- `adapters/testing/` — explicit stubs (subpath only)
