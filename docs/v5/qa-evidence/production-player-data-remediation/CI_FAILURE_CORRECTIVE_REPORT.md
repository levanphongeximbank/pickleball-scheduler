# Production Player Data Remediation — CI Failure Corrective Report

**Timestamp:** 2026-08-05T09:20:00.000Z  
**Verdict:** `PRODUCTION_PLAYER_DATA_REMEDIATION_CI_CORRECTED_READY_FOR_COMMIT`  
**PR:** #371  
**Failed workflow run ID:** 30991826297  
**Base commit:** `1490863216d87abd35c34f535491d24575ba2ebd`

## Root cause

The Phase 1B facade test applied the **engine-facing** gender contract (`male|female|unknown`) to `normalizePlayerProfile()`, which uses the **canonical stored** contract via `normalizePlayerGender()` → `getPlayerGenderKey()` (`male|female|other|null`).

| Layer | Function | `other` / `Khác` |
|-------|----------|------------------|
| Canonical profile | `normalizePlayerProfile` → `normalizePlayerGender` → `getPlayerGenderKey` | `other` |
| Engine eligibility | `normalizeAthleteGender` / `normalizeEngineGender` | `unknown` |

CI failure:

- expected (stale): `"unknown"`
- actual (canonical): `"other"`

## Correction

**File:** `tests/player-management-phase-1b-facade.test.js` only

```diff
- assert.equal(normalizePlayerProfile({ gender: "other" }).gender, "unknown");
- assert.equal(normalizePlayerProfile({ gender: "Khác" }).gender, "unknown");
+ assert.equal(normalizePlayerProfile({ gender: "other" }).gender, "other");
+ assert.equal(normalizePlayerProfile({ gender: "Khác" }).gender, "other");
```

Added separate engine-facing assertions:

- `normalizeAthleteGender("other")` → `unknown`
- `normalizeAthleteGender("Khác")` → `unknown`
- `normalizeAthleteGender(null)` → `unknown`

**Implementation files changed:** 0

## Validation (independently run)

| Check | Result |
|-------|--------|
| player-management-phase-1b-facade | 18 PASS / 0 FAIL |
| Focused gender remediation | 14 PASS / 0 FAIL |
| account-only-athlete | 12 PASS / 0 FAIL |
| Tournament female-related | 16 PASS / 0 FAIL |
| QuickAdd / QA filter / smoke dry-run / writer guard | covered in remediation suite PASS |
| Full unit (`npm run test:unit`) | **6838 PASS / 0 FAIL** / 0 cancelled / 0 skipped |
| lint:no-new | PASS |
| build | PASS |
| diff-check | PASS (1 test file) |
| cached diff-check | PASS (0 staged) |
| secret scan | PASS (0 hits) |
| package/lockfile changed | NO |

## Safety

- Production mutations = 0
- SQL apply = 0
- migration apply = 0
- deployments = 0
- quarantine/ban execution = 0
- commit = NO
- push = NO
- Production GO = NO

## Independent re-review of local diff

- Canonical implementation unchanged
- Only stale test expectations + this evidence
- Profile `other` remains `other`; engine `other` remains `unknown`
- Full unit suite green
- Unrelated files = 0; staged = 0
