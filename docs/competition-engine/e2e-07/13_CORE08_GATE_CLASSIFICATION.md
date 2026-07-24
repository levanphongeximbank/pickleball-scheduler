# E2E-07 — CORE-08 Phase 1E Branch-Local Delta Gate Classification

## Identity

| Field | Value |
|-------|-------|
| File | `tests/competition-core-draw-runtime-core08-1e-certification.test.js` |
| Test | `1E: production engines / UI / SQL / deploy absent from branch-local delta` |
| Mechanism | `git diff --name-only origin/main...HEAD` (`branchDeltaNames`) |
| Official CI | **Excluded** from `scripts/ci/unit-test-files.json` (by CORE-08 design) |

## Fresh-main control

Temporary detached worktree at `origin/main` (`6df46e3d`):

| Observation | Value |
|-------------|-------|
| Delta file count | `0` |
| Assertion | `expected >=31 branch files, got 0` |
| Exit code | `1` |

**Classification:** `PRE_EXISTING_MAIN_FAILURE`

On `main`, HEAD ≡ `origin/main`, so the branch-local delta is empty. The ≥31 size gate cannot pass outside an active CORE-08 implementation branch.

## E2E-07 branch observation

On `feature/competition-e2e-07-end-to-end-certification` (`89b284ad`+):

| Observation | Value |
|-------------|-------|
| Delta includes | E2E-07 certification + docs + additive `scripts/ci/unit-test-files.json` |
| Assertion | `unauthorized touched file: scripts/ci/unit-test-files.json` |
| Exit code | `1` |

CORE-08 Phase 1E forbids `scripts/ci/unit-test-files.json` inside **its own** branch delta policy. E2E-07 (and prior E2E waves) legitimately append certification tests to that shared CI registry. Hitting this forbid list is **policy collision with a CORE-08-local gate**, not a Competition Core behavior regression.

**Policy label:** `BRANCH_LOCAL_DELTA_POLICY`

## Ownership proof (E2E-07 vs CORE-08)

`git diff --name-only origin/main...HEAD` for E2E-07 touches:

- **zero** `src/features/competition-core/**`
- **zero** `docs/competition-engine/core-08/**`
- **zero** `tests/competition-core-draw-runtime-core08*`
- **zero** `scripts/ci/unit-test-files.phase-core08*`

Frozen CORE-08 1E test file content is **byte-identical** to `origin/main`.

`scripts/ci/unit-test-files.json` delta is **additive only**: new `tests/competition-engine-e2e-07-*` entries; no removals.

## Remediation policy (E2E-07)

| Action | Status |
|--------|--------|
| Modify CORE-08 implementation | **Forbidden** |
| Modify CORE-08 tests / docs | **Forbidden** |
| Skip / delete failing 1E test | **Forbidden** |
| Claim frozen 1E test PASS on E2E-07 | **Forbidden** |
| Certification control test | `tests/competition-engine-e2e-07-core08-gate-classification.test.js` |
| Evidence | `docs/competition-engine/e2e-07/evidence/core08-gate-classification.json` |

## Gate implication for PR #239

- Official CI does **not** run CORE-08 1E certification (by CORE-08 contract).
- Manual “Core vertical subset” that includes this 1E delta assertion will still report **FAIL** on `main` and on E2E-07 — classified, not silently greened.
- E2E-07 merge readiness for this item: **no Core regression** + classification control **PASS**.
