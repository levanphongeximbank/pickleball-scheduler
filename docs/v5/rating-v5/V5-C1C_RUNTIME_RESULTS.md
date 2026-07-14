# V5-C.1C — Runtime Results

**Phase:** V5-C.1C Wave 1 account preparation  
**Date:** 2026-07-13  
**Environment:** Supabase Staging (`qyewbxjsiiyufanzcjcq`)

## Commands

```bash
npm run qa:v5c1c:prepare
npm run qa:v5c1c:verify
node --test tests/rating-v5-wave1-account-prep.test.js
```

## Account preparation

| Step | Result |
|------|--------|
| `prepare-rating-v5-wave1-accounts.mjs` | **12/12 READY** |
| New accounts created | 10 |
| Cohort CSV written | `V5-C1C_WAVE1_COHORT_REVIEW.csv` |
| Secret scan (prepare report) | PASS |

## Account preparation tests (12/12)

| # | Test | Result | Detail |
|---|------|--------|--------|
| 1 | Staging ref | **PASS** | `qyewbxjsiiyufanzcjcq` |
| 2 | Production ref blocked | **PASS** | No production ref in URL |
| 3 | Auth user mapping | **PASS** | `candidate_count=12` |
| 4 | Player mapping | **PASS** | 12 profiles aligned 1:1 |
| 5 | Tenant consistency | **PASS** | All tenants set and match manifest |
| 6 | Role consistency | **PASS** | All `PLAYER` |
| 7 | Duplicate prevention | **PASS** | 0 duplicate auth/email; 0 active enrollment in cohort |
| 8 | Non-enrolled route block | **PASS** | `rating.wave1.01` → `PILOT_NOT_ENROLLED` (gate RPC) |
| 9 | Non-enrolled Edge block | **PASS** | `rating-v5-complete-assessment` → `PILOT_NOT_ENROLLED` |
| 10 | Secret scan | **PASS** | Cohort CSV clean |
| 11 | V2 unchanged | **PASS** | V2 rating unchanged for probe user |
| 12 | Production isolation | **PASS** | Staging-only requests |

**ACCOUNT PREPARATION TESTS: 12/12 PASS**

## Supplementary checks (verify script)

| Check | Result |
|-------|--------|
| All emails `@staging.local` | PASS |
| Skill bands `4/5/3` | PASS |

## Non-enrolled proof (probe: `rating.wave1.01@staging.local`)

| Gate | Expected | Observed |
|------|----------|----------|
| `rating_v5_get_my_pilot_enrollment` | not enrolled | not enrolled |
| `rating_v5_assert_pilot_gate` (start) | `PILOT_NOT_ENROLLED` | `PILOT_NOT_ENROLLED` |
| Edge `rating-v5-complete-assessment` | blocked | `PILOT_NOT_ENROLLED` |

## Unit tests

`tests/rating-v5-wave1-account-prep.test.js` — manifest, CSV, and script guard checks (no live DB).

## Evidence

- `docs/v5/rating-v5/qa-evidence/v5-c1c-wave1/2026-07-13T12-15-38-895Z/REPORT.json`
- `artifacts/rating-v5-wave1/2026-07-13T12-15-05-589Z/prepare-report.json`
