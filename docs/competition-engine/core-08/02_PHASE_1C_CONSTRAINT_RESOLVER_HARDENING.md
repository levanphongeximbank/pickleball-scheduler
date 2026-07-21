# CORE-08 Phase 1C — Constraint Resolver Hardening

**Status:** Capability-local (dormant). No production cutover.
**Prerequisite:** Phase 1B `f66e7592bcb41dc60b15f878b7e4f9b3b99b8c46`
**Canonical placement SSOT:** Phase 3H (`draw-runtime/**`)
**Orchestration API:** `createDrawResolver({ constraintResolver? }).resolve(request)`

## Objective

Harden the existing optional `constraintResolver` DI boundary so Draw Runtime can:

1. Produce the canonical Phase 3H placement proposal.
2. Pass a frozen, normalized proposal to an injected generic resolver (once).
3. Accept unchanged or valid adjusted canonical placements.
4. Reject invalid / unsafe resolver output fail-closed.
5. Emit deterministic decision-trace / diagnostics.
6. Preserve placement invariants.
7. Remain byte-compatible when no resolver is supplied.

CORE-08 does **not** own club/unit/host/visitor rule definitions, private pairing evaluation, or legacy constraint repair.

## Contract

Resolver may be:

- a function `(input) => result | Promise<result>`
- or `{ resolveConstraints(input) => result | Promise<result> }`

Matcher: `matchesConstraintResolver` / `normalizeConstraintResolver`
Port module: `draw-runtime/ports/constraintResolverPort.js`

### Input (frozen)

Canonical placements, eligible candidates, groups/brackets/byes, unresolved candidates, decisionTrace, drawMode/layout bounds, drawIdentityKey, competition/context ids, `deterministicSeed`, request context/metadata, manual/protected overlays.

### Result shapes

| Shape | Meaning |
|-------|---------|
| `{ ok: true, accepted: true }` | Keep Phase 3H proposal |
| `{ ok: true, placements, decisionTrace? }` | Adjusted proposal (revalidated) |
| `{ ok: false, code?, message?, details? }` | Typed fail-closed |
| throw `DrawRuntimeError` | Typed fail-closed |

Invalid / malformed output → `DRAW_CONSTRAINT_OUTPUT_INVALID` or `DRAW_CONSTRAINT_INVARIANT_VIOLATION`.
Unexpected throw → `DRAW_CONSTRAINT_RESOLUTION_FAILED`.

## Invocation point

**After** Phase 3H placement algorithms, **before** identity register / persistence snapshot.

Rationale: Phase 3H remains placement SSOT; the hook is a post-placement extension that cannot invent a second placement engine and cannot silently replace a failed constraint path with unconstrained output.

## Adapter Target D

`runConstraintGroupingAdapter`:

| Constraints | Injected resolver | Behavior |
|-------------|-------------------|----------|
| empty | any | Snake via Phase 3H (unchanged) |
| non-empty | absent | `ADAPTER_CONSTRAINTS_UNSUPPORTED` / `HARDENING_REQUIRED` |
| non-empty | present | Delegate to Phase 3H; constraints in `context`; resolver runs via hook |

Adapter does not repair, does not import `pairing-constraints`, and does not define format rules.

## Tests

- `tests/competition-core-draw-runtime-core08-1c.test.js`
- Capability manifest: `scripts/ci/unit-test-files.phase-core08-1c.json`

## Production safety

| Gate | Status |
|------|--------|
| Production callers switched | NONE |
| Feature flags | unchanged |
| Phase 3H placement algorithms modified | NO (hook only) |
| Legacy constraint engine imported | NO |
| Root `competition-core/index.js` | untouched |
| Official CI `unit-test-files.json` | untouched |
| UI / SQL / deploy | NONE |

## Deferred

- Club/unit/host search rules
- Format-specific constraint definitions
- Open shuffle-then-snake compatibility (Phase 1D)
- Input fingerprint / ruleset version
- Executable bye policy extension
- Root export / official CI / production cutover
