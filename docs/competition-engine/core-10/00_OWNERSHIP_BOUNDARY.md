# CORE-10 — Ownership Boundary

**Module:** `src/features/competition-core/optimizer/`
**Capability-local public surface:** `optimizer/index.js`
**Protected:** root `competition-core/index.js` (Integrator-owned; Phase 1B / 1C-A / 1C-B1 / 1C-B2-A / 1C-B2-B / 1C-C do not modify it)

---

## 1. CORE-10 owns

- Generic optimization contracts (`OptimizationRequest`, `CandidateSolution`, `OptimizationResult`, …)
- Deterministic execution primitives (canonical serialization, fingerprinting, seeded PRNG, stable comparators)
- Structural request and candidate validation (schema, scope, snapshot refs, decision domains, budgets)
- Rankable score representation and lexicographic comparison
- Replay metadata for replay-certified runs
- Generic diagnostics contracts
- Solver extension contracts (strategy identifiers, operation identifiers, policy shapes)
- Phase 1C-A objective definitions, immutable registry, synchronous objective evaluation
- Phase 1C-B1 candidate-evaluation input/dependencies contracts, HardViolation, ConstraintEvaluationPort, structural candidate-input validation, hard-violation composition
- Phase 1C-B2-A CandidateEvaluationFailure / CandidateEvaluationResult, candidate score composition, candidate input fingerprint helper
- Phase 1C-B2-B `evaluateCandidateSolution` orchestration (input/deps validation, port invocation, hard-feasibility gate, objective/score composition)
- Phase 1C-C `createCandidateEvaluationResultFingerprint` (explicit result-content fingerprint; no schema attach)

CORE-10 is a **generic optimizer substrate**. It does not implement domain algorithms owned by other COREs.

Phase 1C-C does **not** own candidate ranking across a search frontier, search solvers, or CORE-01 adapters.

---

## 2. CORE-10 does not own

| Concern | Owner |
|---------|-------|
| Rule Engine business-rule evaluation | CORE-01 |
| Participant / Entry mutation | CORE-02 |
| Registration / eligibility | CORE-03 |
| Division / Category management | CORE-04 |
| Team roster / lineup submission | CORE-05 / CORE-06 |
| Seeding allocation | CORE-07 |
| Draw / Grouping algorithms | CORE-08 |
| Match generation strategies / MatchPlan | CORE-09 |
| Schedule date / time / court / referee | Scheduling / Court / Referee modules |
| UI / database / Supabase / persistence wiring | Product / Integrator |

Phase 1B does **not** create dependencies on CORE-03 or CORE-06.
Phase 1C-B1 does **not** import CORE-01 private implementations and does **not** ship a CORE-01 adapter.
Phase 1C-B2-A / 1C-B2-B / 1C-C likewise do **not** import CORE-01 private implementations and do **not** ship a CORE-01 adapter.

---

## 3. Allowed dependency direction

```text
Other COREs (public contracts only)
        │
        ▼
   CORE-10 Optimizer   ← consumes immutable snapshots / refs
        │
        ▼
  OptimizationResult / ReplayMetadata / Diagnostics
```

- CORE-10 may **consume** public contracts from upstream COREs after Integrator wiring.
- CORE-10 must **not** deep-import private implementations from another CORE.
- Upstream COREs must **not** depend on CORE-10 private paths.
- Public-contract-only dependency rule: only capability-local `index.js` exports (or documented public ports) may be imported across CORE boundaries.

---

## 4. Explicit non-ownership

- **No Schedule ownership** — CORE-10 does not create, mutate, or score schedule timelines.
- **No Court Assignment ownership** — CORE-10 does not assign courts.
- **No Referee Assignment ownership** — CORE-10 does not assign referees.
- **No database ownership** — no SQL, Supabase, or persistence adapters in Phase 1B.
- **No UI ownership** — no pages, routes, or components.
- **No deep import from private implementations** of other COREs.

---

## 5. Namespace

```text
competition-core/
  optimizer/           ← CORE-10 (this module)
  constraints/         ← CORE-01 Rule Engine — NOT CORE-10
  scheduling/          ← Schedule — NOT CORE-10
  match-generation/    ← CORE-09 — NOT CORE-10
```

---

## 6. Anti-patterns

- Implementing `MIN_REST_TIME` or other business rules inside CORE-10
- Treating hard feasibility, MatchPlan integrity, or search stability as objective keys
- Using ambient randomness (`Math.random`) or wall-clock values in ranking / replay fingerprints
- Deep-importing private helpers from another CORE to work around missing public contracts
- Exporting Schedule / Court / Referee capabilities from `optimizer/index.js`
- Modifying root `competition-core/index.js` before Integrator certification
