# E2E-07 — CORE-08 Phase 1E Branch-Local Delta Gate Classification

## Identity

| Field | Value |
|-------|-------|
| File | `tests/competition-core-draw-runtime-core08-1e-certification.test.js` |
| Test | `1E: production engines / UI / SQL / deploy absent from branch-local delta` |
| Mechanism (frozen CORE-08) | `git diff --name-only origin/main...HEAD` (`branchDeltaNames`) |
| Official CI — CORE-08 1E | **Excluded** from `scripts/ci/unit-test-files.json` (by CORE-08 design) |
| Official CI — classification control | **Included** in `scripts/ci/unit-test-files.json` and **does run** under `npm run test:unit` |
| Pure model | `src/features/competition-engine/certification/core08GateClassification.js` |

## Execution modes

| Mode | When | Behavior |
|------|------|----------|
| `FEATURE_BRANCH_DELTA_MODE` | Live delta vs comparison base is **non-empty** | Assert live delta does not touch CORE-08 ownership (`src/features/competition-core/draw-runtime/`, `docs/competition-engine/core-08/`, `tests/competition-core-draw-runtime-core08*`, `scripts/ci/unit-test-files.phase-core08*`). Other Competition Core files (shared ĐẦU A court adapter, later cores, Integrator barrel) are inspected and must remain CORE-08-clean because they are **not** CORE-08-owned. **only when** the live delta includes both `unit-test-files.json` **and** at least one E2E-07-owned path (`tests/competition-engine-e2e-07-`, `src/features/competition-engine/certification/`, `docs/competition-engine/e2e-07/`, …), validate additive E2E-07 registry changes and reproduce branch-local failure from live names. Unrelated workstreams that only touch the shared registry are **not** classified as E2E-07 registry additions. |
| `MERGED_MAIN_MODE` | Live delta is **empty**, or comparison base is **unavailable** | Do **not** require non-empty live delta; do **not** auto-PASS; validate committed evidence snapshot + registry presence + CORE-08 content hash; replay classifier from `classifiedBranchDelta.fileNames` |

Both modes share one classification model: `classifyCore08BranchDelta` / `reproduceCore08BranchLocalGate`.

## Post-merge failure (after PR #239)

On fresh `main` after merge, `HEAD ≡ comparison base` → live delta count **0**.

Assertions that required a non-empty live delta failed (25 targeted / 22 pass / **3** fail):

1. `core08 gate — E2E-07 delta does not touch Competition Core ownership`
2. `core08 gate — E2E-07 unit-test-files.json touch is additive certification registration only`
3. `core08 gate — reproduce branch-local assertion failure without claiming PASS`

**Classification:** merged-main test-design defect (not a Competition Engine runtime regression).

## Official CI clarification

Excluding CORE-08 1E from the official unit-test manifest does **not** mean the E2E-07 classification control is skipped. The classification file runs under `npm run test:unit`.

## CI base-ref remediation (PR #239 era)

Shallow checkout without `origin/main` was fixed via `fetch-depth: 0` + `resolveComparisonBase()` fallbacks. That fix remains; this document adds **merged-main** safety on top.

## Fresh-main control (pre-E2E-07)

Temporary detached worktree at `origin/main` (`6df46e3d`):

| Observation | Value |
|-------------|-------|
| Delta file count | `0` |
| Assertion | `expected >=31 branch files, got 0` |
| Exit code | `1` |

**Classification:** `PRE_EXISTING_MAIN_FAILURE`

## E2E-07 branch observation (pre-merge)

| Observation | Value |
|-------------|-------|
| Delta includes | E2E-07 certification + docs + additive `scripts/ci/unit-test-files.json` |
| Assertion | `unauthorized touched file: scripts/ci/unit-test-files.json` |
| Exit code | `1` |

**Policy label:** `BRANCH_LOCAL_DELTA_POLICY`

Committed snapshot lives in `evidence/core08-gate-classification.json` → `payload.classifiedBranchDelta` (56 files; unauthorized touch = `scripts/ci/unit-test-files.json`; CORE-08 owned path touches = 0).

## Ownership proof

E2E-07 classified branch delta touches:

- **zero** `src/features/competition-core/**`
- **zero** `docs/competition-engine/core-08/**`
- **zero** `tests/competition-core-draw-runtime-core08*`
- **zero** `scripts/ci/unit-test-files.phase-core08*`

Frozen CORE-08 1E content SHA-256 is pinned in evidence (`core08FrozenTestContentSha256`).

## Remediation policy

| Action | Status |
|--------|--------|
| Modify CORE-08 implementation / tests / docs | **Forbidden** |
| Skip / delete failing 1E test | **Forbidden** |
| Skip classification on main / `process.env.CI` auto-PASS | **Forbidden** |
| Auto-PASS because live delta is empty | **Forbidden** |
| Network fetch inside unit test | **Forbidden** |
| Evidence | `docs/competition-engine/e2e-07/evidence/core08-gate-classification.json` |

## Gate implication

- Official CI does **not** run frozen CORE-08 1E.
- Official CI **does** run this classification control on feature branches **and** on merged main.
- Frozen 1E branch-local assertion remains a classified FAIL when executed manually — never silently greened.
- E2E-07 registry-addition validation is scoped to live deltas that contain E2E-07-owned paths **and** actually add `tests/competition-engine-e2e-07-*` registry entries. Touching `scripts/ci/unit-test-files.json` alone, or touching classification metadata while adding unrelated tests, is **not** classified as E2E-07 registry work.
- Live CORE-08 ownership is `draw-runtime` + CORE-08 docs/tests/phase manifests — not the entire `src/features/competition-core/` tree. Historical E2E-07 classified delta still touches zero `src/features/competition-core/**`.
