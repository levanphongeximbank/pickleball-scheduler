# CORE-10 — Deterministic Candidate Source Contract (Phase 1H)

**Module:** `src/features/competition-core/optimizer/`
**Version:** `CORE10_CANDIDATE_SOURCE_PORT_V1`
**Capability:** Candidate Batch contract + synchronous Candidate Source Port

---

## Phase objective

Introduce a capability-local, synchronous, deterministic **Candidate Source Port** and a formal **Candidate Batch** contract for unevaluated supplied candidates.

Phase 1H is a **contract boundary only**. It does not generate candidates, search, evaluate, rank, enforce budgets, or wire a new optimizer entry point.

---

## Ownership boundary

### CORE-10 owns

- Candidate Batch contract validation
- Candidate Source Port validation
- Synchronous deterministic source execution (`produce`)
- Output immutability
- Stable `candidateId` validation
- Duplicate `candidateId` rejection
- Source capability versioning (`CORE10_CANDIDATE_SOURCE_PORT_V1`)
- Capability-local exports
- Focused contract tests

### CORE-10 does not own

- Match generation / schedule / court / referee assignment
- Domain candidate construction
- Domain semantic deduplication
- Greedy / exhaustive search
- Search-node traversal / `maxNodes` execution
- Root integration / production wiring
- Domain-specific source implementations (owned by CORE-09 / CORE-11 / CORE-12 / CORE-13 / CORE-14 / future adapters)

Do not import sibling CORE private implementations.

---

## Candidate Batch shape

Factory: `createCandidateBatch(partial)`

| Field | Required | Notes |
|-------|----------|-------|
| `candidates` | yes | Array; empty allowed at contract level |
| `decisionVariables` | yes | Array (structural clone; full DV validation at evaluation time) |
| `objectiveExecutionSpecs` | yes | Array (structural clone) |
| `authorityValues` | yes | Array (structural clone) |
| `context` | no | Plain object when provided |

Each candidate item:

| Field | Notes |
|-------|-------|
| `candidateId` | Caller/source-supplied stable non-empty ID |
| `assignments` | Array of `{ variableId, valueId }` |

Compatible with Phase 1F/1G supplied-candidate orchestration batch shape. Does **not** change the evaluated `CandidateSolution` contract. Unknown top-level / candidate / assignment fields fail closed.

---

## Candidate Source Port shape

Factories:

- `createCandidateSourcePort({ portId, portVersion?, produce })`
- `isCandidateSourcePort(port)`
- `createFixedCandidateSourcePort({ portId, portVersion?, batch })` (deterministic test/reference double)

Public port fields: `portId`, `portVersion`, `produce`.

```text
produce(request, sourceContext) → frozen CandidateBatch
```

- `portId` is caller/source-supplied and validated as a stable ID (not auto-generated).
- Default `portVersion` is `CORE10_CANDIDATE_SOURCE_PORT_V1`.
- Raw producer is closed over; not exposed as a port property.
- Returned output is always validated through `createCandidateBatch`.
- Raw mutable source output must not escape.

`portId` purpose: identify the concrete source adapter for diagnostics / replay binding later. It is not decorative and must not be a UUID/timestamp.

---

## Synchronous-only rule

- `produce` must execute synchronously.
- Promise / thenable return values are rejected.
- Thenable `request` / `sourceContext` arguments are rejected.
- No timers, IO, databases, environment reads, or host-specific values.

---

## candidateId responsibility

- `candidateId` is supplied by the source or caller.
- CORE-10 does **not** generate IDs.
- CORE-10 validates `candidateId` via the stable-ID helper (non-empty trimmed string).
- Random UUIDs, timestamps, content-hash IDs, and sequence-assigned IDs are forbidden as CORE-10 behaviors.
- Semantic equivalence is **not** evaluated in Phase 1H.

---

## Duplicate policy

- Duplicate `candidateId` values are rejected with `DUPLICATE_CANDIDATE_ID`.
- Structural / semantic duplicates with different IDs are preserved.
- No silent deduplication.

---

## Ordering policy

- The source port may return candidates in any order.
- Phase 1H does **not** reorder candidates inside the batch contract or source port.
- Phase 1G orchestration continues to canonicalize by `candidateId` before budget truncation.
- Ordering responsibility is **not** moved into the source port.

---

## Immutability

- Caller-provided mutable structures are cloned.
- Input objects are not mutated.
- Returned Candidate Batch structures are deep-frozen per repository conventions.
- Caller / source mutation after `produce` must not change prior output.
- Repeated `produce` over equivalent inputs returns structurally deterministic results.

---

## Determinism

Preserves existing CORE-10 guarantees:

- no random IDs or ordering
- no wall-clock / locale dependence
- no mutable shared output
- no hidden process state
- stable duplicate detection, validation, and error behavior
- no async race behavior

---

## Error behavior

Fail closed via `OptimizerContractError`:

| Situation | Typical code |
|-----------|--------------|
| Invalid batch / candidate / assignment / port shape | `INVALID_REQUEST` |
| Duplicate `candidateId` | `DUPLICATE_CANDIDATE_ID` |
| Async / thenable produce result | `INVALID_REQUEST` |
| Source throws non-contract error | wrapped as `INVALID_REQUEST` |
| Source throws `OptimizerContractError` | rethrown unchanged |

Contract validation errors are never mapped into successful optimizer results.

---

## Budget non-ownership

Source `produce()` does **not**:

- consume budget
- decrement counters
- stop on `maxCandidates` / `maxEvaluations`
- implement `maxNodes`

Phase 1G budget semantics on `optimizeSuppliedCandidates` remain unchanged.

---

## Replay implications

- Stable `portId` / `portVersion` and frozen Candidate Batch outputs are replay-safe building blocks.
- Phase 1H does not attach replay metadata by itself.
- Future phases may bind source identity into orchestration fingerprints without changing this contract.

---

## Explicit exclusions / non-claims

Phase 1H is **not**:

- candidate generation
- greedy or exhaustive search
- a production global optimizer
- an overload of `optimizeSuppliedCandidates`
- a new `optimizeGeneratedCandidates` / `runOptimization` entry point
- lazy iterators or async sources

---

## Future Phase 1I wiring boundary

A later phase may wire an approved Candidate Source Port into orchestration. Phase 1H deliberately stops before that wiring so the contract can be reviewed independently.

---

## Public Phase 1H API (capability-local)

`createCandidateBatch`, `createCandidateSourcePort`, `isCandidateSourcePort`, `createFixedCandidateSourcePort`, `CORE10_CANDIDATE_SOURCE_PORT_V1`.

Exported only through `src/features/competition-core/optimizer/index.js`.

Root `src/features/competition-core/index.js` remains unchanged.
