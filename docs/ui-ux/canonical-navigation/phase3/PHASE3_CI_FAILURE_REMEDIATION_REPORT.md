# Phase 3 CI Failure Remediation Report

**Program:** PICK_VN Canonical Navigation  
**Phase:** 3 — CI Failure Triage and Corrective Pass  
**Branch:** `feature/canonical-navigation-phase3-menu-rollout`  
**PR:** #378  
**Head at failure:** `70a8d97410c2e29f5704aa5c6d6de3206ce3fc3e`  
**Generated:** 2026-08-05  

## Final Verdict

**`CANONICAL_NAVIGATION_PHASE3_CI_CORRECTED_READY_FOR_REREVIEW`**

## Failure Identity

| Field | Value |
|-------|-------|
| Workflow | Production CI Gate |
| Run | https://github.com/levanphongeximbank/pickleball-scheduler/actions/runs/31021841700 |
| Job | `verify` |
| Failed step | Unit tests |
| Exact command | `npm run test:unit` |
| Exit code | 1 |
| Deterministic | YES (2/6871 failures; same assertion locally) |
| Class | code/test companion to approved dependency (not env flake) |

## Failing Tests (from CI logs)

1. `tests/business-modules-final-certification.test.js`  
   - `package and lock hashes match baseline; court authority fail-closed remains`  
   - Expected `package.json` SHA `3D40EFE6…` vs actual `C9030322…`

2. `tests/coaching-05-final-certification-closure.test.js`  
   - `package/lock hashes unchanged from certified pins (sha256-lf-normalized)`  
   - Same `package.json` pin mismatch (lock pin also stale)

## Root-Cause Classification

**`PACKAGE_LOCK_DEFECT`**

Approved Phase 3 addition of `@fontsource/inter@^5.3.0` correctly changed `package.json` / `package-lock.json`. LF-normalized SHA-256 certification pins in two unit tests were not updated with that intentional dependency change. CI unit gate failed on pin mismatch. Phase 3 functional tests themselves all passed in the same CI run.

Not BASE_DRIFT_CONFLICT: fresh `origin/main` is `6fd0d6cc` (tournament evidence #379; no overlap with the four corrective files).

## Local Reproduction

| Check | Result |
|-------|--------|
| `npm run test:unit` (pre-fix) | FAIL — same 2 tests |
| Exact failing tests after pin update | PASS 18/18 |
| `npm run test:unit` (post-fix) | PASS **6871/6871** |

## Correction Applied (minimum)

Updated LF-normalized pins only:

| File | Change |
|------|--------|
| `tests/business-modules-final-certification.test.js` | `EXPECTED_PACKAGE_JSON_SHA256_LF` / `EXPECTED_PACKAGE_LOCK_SHA256_LF` |
| `tests/coaching-05-final-certification-closure.test.js` | `PKG_SHA` / `LOCK_SHA` |

New pins:

- package.json → `C9030322D904741CE2E2BBF7E45B0D2D23F60E4CB5F349470CE42D45BF1D96CA`
- package-lock.json → `E9FBBC076F0F41EB4F7EB40E52F6A448CBE8CCC80709F595EA8D1D7C927AF265`

Historical coaching module hashes (`HISTORICAL_*`) unchanged. No runtime/shell source changes. No package/lockfile content changes in this remediation.

## Compatibility

| Field | Value |
|-------|-------|
| Fresh origin/main | `6fd0d6ccafa2f2f77cb40eaad7a0cee2d921fa81` |
| Drift vs prior known tip | +1 (`6fd0d6cc` — tournament evidence commit #379) |
| Overlap with remediated files | None |
| Rebase | Not performed |

## Regression / Safety Re-check

| Gate | Result |
|------|--------|
| Exact failed command rerun | PASS 6871/6871 |
| Phase 3 focused | PASS 14/14 |
| Phase 2 shell | PASS 18/18 |
| app-shell-v5 | PASS 18/18 |
| UI shell suite | PASS 8/8 |
| Accessibility (drawer contracts) | PASS |
| lint:no-new | PASS |
| build | PASS |
| Secret scan | PASS (0 hits) |
| Package/lockfile scope | Still Inter-only (`^5.3.0` / 5.3.0) |
| 179 reconciliation | PASS (75 active + 7 contextual) |
| W01–W05 | CLOSED |
| B01/B02/B03 | PASS |
| Feature flag default | OFF |

## Safety Attestation

| Check | Value |
|-------|------:|
| Production mutations | 0 |
| SQL execution | 0 |
| Deployments | 0 |
| Production feature flag changes | 0 |
| Commit | NO |
| Push | NO |

## Blockers / Warnings

- Blocker count: **0**
- Warning count: **0** (new for this remediation; prior PR body warnings W01–W04 remain documented on #378)

## Final Git Status

Dirty working tree: 2 modified certification test files only. Ready for independent re-review before commit/push.
