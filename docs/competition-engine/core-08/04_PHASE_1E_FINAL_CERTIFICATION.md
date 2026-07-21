# CORE-08 Phase 1E — Final Certification

**Status:** Capability-local certification complete. No production cutover.
**Branch HEAD (Phase 1D):** `4223b4a5c3c40f15cd9b5fc4699affc6297fac68`
**Baseline `origin/main`:** `a5563b23142c434d6f5ac64c568b9a4f443c2feb`
**Canonical placement SSOT:** Phase 3H (`src/features/competition-core/draw-runtime/**`)
**Orchestration API:** `createDrawResolver(options).resolve(drawResolveRequest)`

## Objective

Certify that CORE-08 Draw & Grouping is ready for a later Integrator wave by locking architecture, ownership, adapter boundaries, constraint port, and open-draw compatibility — without changing runtime behavior or starting production integration.

## Accepted CORE-08 history (synchronized)

| Commit | Summary |
|--------|---------|
| `0c4cbbd` | Phase 1B — certify draw runtime adapters |
| `e136ee1` | Phase 1C — harden draw constraint resolver |
| `1cc528c` | Documentation hygiene |
| `4223b4a` | Phase 1D — open shuffled snake draw mode |

## Canonical API

### Entry point

```javascript
createDrawResolver(options).resolve(drawResolveRequest)
```

Capability-local export: `src/features/competition-core/draw-runtime/index.js`.
Root `src/features/competition-core/index.js` does **not** re-export Draw Runtime.

### Input contract

| Field | Role |
|-------|------|
| `competitionId` | Competition identity (required) |
| `contextId` | Context identity (required) |
| `candidates` | Canonical candidates |
| `seedAssignments` | Immutable seed references (caller-supplied) |
| `drawMode` | Canonical mode |
| `groupCount` / `groupCapacity` | Group layout bounds |
| `bracketSize` | Bracket size where applicable |
| `deterministicSeed` | Deterministic RNG seed |
| `manualPlacements` / `protectedPlacements` | Overlay placements |
| `options.constraintResolver` (DI) | Optional generic post-placement resolver |
| `persistence` (DI) | Optional persistence port |

### Output contract

Typed success/failure envelope with: `placements`, `groups`, `brackets`, `byes`, `candidates`, `unresolvedCandidates`, `excludedCandidates`, `identity`, `decisionTrace`, `diagnostics`, optional `snapshot`.

### Supported canonical behavior

- Snake / serpentine / seeded / pot groups
- Deterministic open round-robin (`OPEN_RANDOM_GROUPS`)
- Deterministic open shuffled-snake (`OPEN_SHUFFLED_SNAKE_GROUPS`)
- Manual and protected placement
- Seeded and open brackets with first-class byes
- Capacity enforcement and typed validation/overflow failures
- Generic post-placement constraint resolver (Phase 1C)

### Typed errors

`DRAW_RUNTIME_ERROR_CODE` / `DrawRuntimeError` for runtime failures; adapter certification uses `DRAW_CERTIFICATION_ERROR_CODE` (fail-closed, never silent default).

### Persistence boundary

Optional DI port only. Default is noop / off. CORE-08 does not own persistence implementation (CORE-03).

## Phase boundary certification

| Phase | Claim |
|-------|-------|
| 3H | Canonical Draw Runtime and placement SSOT |
| 1B | Adapters = mapping + delegation only |
| 1C | Safe generic constraint resolver boundary |
| 1D | Shuffle-then-snake via existing primitives only |
| 1E | Final certification + integration handoff docs |

## Ownership summary

CORE-08 owns: request normalization, candidate/seed-reference **consumption**, draw-mode selection, group count/capacity enforcement, seeded/unseeded/open placement algorithms (Phase 3H), deterministic randomization primitives, generic constraint **invocation**, bye/overflow handling, draw identity, audit decision-trace emission, persistence **port**.

CORE-08 does **not** own: seed/rating calculation, participant eligibility, format-specific constraint definitions, fixture/schedule/court/referee/scoring, UI orchestration, production cutover, persistence implementation.

Full matrix: see § Ownership in this certification report and `05_INTEGRATION_HANDOFF.md`.

## Adapter certification summary

| Adapter | Canonical mode | Delegation | Parity |
|---------|----------------|------------|--------|
| Seeded grouping | `SNAKE_GROUPS` | `runCertificationResolve` → `createDrawResolver().resolve()` | Semantic w/ documented differences |
| Open conditional | `OPEN_RANDOM_GROUPS` | same | Structural; format conditions fail closed |
| Team Tournament | `SNAKE_GROUPS` / `OPEN_RANDOM_GROUPS` / `OPEN_SHUFFLED_SNAKE_GROUPS` | same | Seeded semantic; open_random partial; open_shuffled_snake semantic |
| Constraint grouping | `SNAKE_GROUPS` + optional resolver | same | Empty snake; non-empty needs injected resolver |
| CC-04 bridge | mapped mode | facade (no resolve) or delegate | Structural; no `evaluateCanonicalDraw` rewiring |

## Constraint certification summary

- Invocation: after Phase 3H placement, before identity/persist
- At most once; frozen normalized input; output revalidated
- Candidate completeness/uniqueness, capacity, group-count, seed identity, manual/protected invariants enforced
- Failures → typed envelopes; no silent unconstrained fallback
- No club/unit/host/private-pairing rules inside CORE-08

## Open draw certification summary

- `OPEN_SHUFFLED_SNAKE_GROUPS` is additive
- `OPEN_RANDOM_GROUPS` remains shuffle + round-robin
- `SNAKE_GROUPS` remains seed order + snake
- New mode reuses `deterministicShuffle` + `getSnakeGroupIndex` / `placeIntoGroups`
- No new PRNG; Fisher–Yates and snake-index not duplicated in adapters
- TT `placementKind: open_shuffled_snake` maps to the new mode

## Production safety

| Gate | Status |
|------|--------|
| Production callers switched | NONE |
| Feature flags (`DRAW_V2`) | unchanged / off |
| Root `competition-core/index.js` | untouched |
| Official CI `unit-test-files.json` | untouched |
| Legacy engines deleted | NO |
| UI / SQL / deploy | NONE |
| Phase 1E runtime edits | NONE (docs/tests/manifest only) |

## Tests

- Existing: Phase 3H + 1B + 1C + 1D + legacy = **139 pass**
- Certification: `tests/competition-core-draw-runtime-core08-1e-certification.test.js`
- Capability manifest: `scripts/ci/unit-test-files.phase-core08-1e.json`

## Related documents

- `05_INTEGRATION_HANDOFF.md` — Integrator responsibilities
- `06_DEFERRED_GAPS_REGISTER.md` — deferred gaps with owners and cutover risk

## Verdict

`READY_WITH_DOCUMENTED_INTEGRATION_CONDITIONS`

Capability runtime is certified dormant. Integration wave actions remain Integrator-owned and must not be performed in Phase 1E.
