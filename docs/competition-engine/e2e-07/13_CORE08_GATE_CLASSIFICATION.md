# E2E-07 — CORE-08 Phase 1E Branch-Local Delta Gate Classification

## Identity

| Field | Value |
|-------|-------|
| File | `tests/competition-core-draw-runtime-core08-1e-certification.test.js` |
| Test | `1E: production engines / UI / SQL / deploy absent from branch-local delta` |
| Mechanism (frozen CORE-08) | `git diff --name-only origin/main...HEAD` (`branchDeltaNames`) |
| Official CI — CORE-08 1E | **Excluded** from `scripts/ci/unit-test-files.json` (by CORE-08 design) |
| Official CI — classification control | **Included** in `scripts/ci/unit-test-files.json` and **does run** under `npm run test:unit` |

## Official CI clarification

Excluding CORE-08 1E from the official unit-test manifest does **not** mean the E2E-07 classification control is skipped. The classification file:

- `tests/competition-engine-e2e-07-core08-gate-classification.test.js`

is registered in `scripts/ci/unit-test-files.json` and is executed by GitHub Actions `Production CI Gate` → `npm run test:unit`.

## CI failure (PR #239 pre-remediation)

| Field | Value |
|-------|-------|
| Unit tests | 5175 |
| Pass / Fail | 5171 / **4** |
| Failing file | `tests/competition-engine-e2e-07-core08-gate-classification.test.js` |
| Root cause | `fatal: ambiguous argument 'origin/main...HEAD'` — GitHub Actions default shallow checkout has **no usable `origin/main` remote-tracking ref** |
| Classification | CI-environment compatibility defect of the classification control (not a CORE-08 runtime regression) |

Failing assertions (all depended on hardcoded `origin/main`):

1. `core08 gate — E2E-07 delta does not touch Competition Core ownership`
2. `core08 gate — frozen 1E certification test identical to origin/main`
3. `core08 gate — E2E-07 unit-test-files.json touch is additive certification registration only`
4. `core08 gate — reproduce branch-local assertion failure without claiming PASS`

(Metadata + official-manifest tests already passed.)

## Remediation

### Workflow (Method A — object availability)

`.github/workflows/deploy.yml` checkout uses `fetch-depth: 0` so PR base history/objects exist locally. Unit tests still must not `git fetch`.

### Classification test (Method B — base resolution)

`resolveComparisonBase()` fallback order (each candidate verified with `git rev-parse` / object existence; never auto-PASS; never network):

1. usable `origin/main` if present
2. `pull_request.base.sha` from `GITHUB_EVENT_PATH` when the object exists locally
3. explicit `E2E07_COMPARISON_BASE` injection when the object exists locally
4. otherwise typed `ComparisonBaseError` (`COMPARISON_BASE_UNRESOLVED` / `PR_BASE_OBJECT_MISSING` / `INJECTED_BASE_MISSING`)

If the PR base SHA is in the event payload but the object is missing, remediation belongs in checkout/fetch configuration — not inside the unit test.

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

On `feature/competition-e2e-07-end-to-end-certification`:

| Observation | Value |
|-------------|-------|
| Delta includes | E2E-07 certification + docs + additive `scripts/ci/unit-test-files.json` |
| Assertion | `unauthorized touched file: scripts/ci/unit-test-files.json` |
| Exit code | `1` |

CORE-08 Phase 1E forbids `scripts/ci/unit-test-files.json` inside **its own** branch delta policy. E2E-07 (and prior E2E waves) legitimately append certification tests to that shared CI registry. Hitting this forbid list is **policy collision with a CORE-08-local gate**, not a Competition Core behavior regression.

**Policy label:** `BRANCH_LOCAL_DELTA_POLICY`

## Ownership proof (E2E-07 vs CORE-08)

Branch delta vs comparison base for E2E-07 touches:

- **zero** `src/features/competition-core/**`
- **zero** `docs/competition-engine/core-08/**`
- **zero** `tests/competition-core-draw-runtime-core08*`
- **zero** `scripts/ci/unit-test-files.phase-core08*`

Frozen CORE-08 1E test file content is **byte-identical** to the comparison base (and still hardcodes `origin/main` internally — unchanged by design).

`scripts/ci/unit-test-files.json` delta is **additive only**: new `tests/competition-engine-e2e-07-*` entries; no removals.

## Remediation policy (E2E-07)

| Action | Status |
|--------|--------|
| Modify CORE-08 implementation | **Forbidden** |
| Modify CORE-08 tests / docs | **Forbidden** |
| Skip / delete failing 1E test | **Forbidden** |
| Claim frozen 1E test PASS on E2E-07 | **Forbidden** |
| Skip classification in CI / `process.env.CI` auto-PASS | **Forbidden** |
| Catch git error then PASS | **Forbidden** |
| Network fetch inside unit test | **Forbidden** |
| Certification control test | `tests/competition-engine-e2e-07-core08-gate-classification.test.js` |
| Evidence | `docs/competition-engine/e2e-07/evidence/core08-gate-classification.json` |

## Gate implication for PR #239

- Official CI does **not** run frozen CORE-08 1E certification (by CORE-08 contract).
- Official CI **does** run the E2E-07 classification control (registered in `unit-test-files.json`).
- Manual “Core vertical subset” that includes the 1E delta assertion will still report **FAIL** on `main` and on E2E-07 — classified, not silently greened.
- E2E-07 merge readiness for this item: **no Core regression** + classification control **PASS** on local and GitHub Actions-compatible checkouts.
