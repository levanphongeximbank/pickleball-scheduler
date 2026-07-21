# CORE-07 — Phase 1C Domain Foundation Report

**Phase:** 1C — Domain Foundation and Deterministic Comparator
**Branch:** `feature/competition-core-07-seeding`
**Baseline HEAD (Phase 1B):** `5290b378a5f970eceebc6bc5fde55f609cdfb6a4`
**Date:** 2026-07-21
**Status:** Implementation complete with Owner numeric-validation remediation — **committed after Owner authorization**

---

## 1. Safety baseline (pre-change)

| Check | Result |
|-------|--------|
| Workspace | `competition-core-07-seeding` |
| Branch | `feature/competition-core-07-seeding` |
| HEAD | `5290b378a5f970eceebc6bc5fde55f609cdfb6a4` (Phase 1B) |
| Phase 1A present | `0307d812bc0674a59a388b30829e5190971a01fe` |
| Working tree | Clean |
| vs `origin/main` (pre-change) | Ahead 2 / behind 0 |
| vs `origin/main` (post-change note) | `origin/main` advanced during session (CRM merge); now ahead 2 / behind 4 — **no merge/rebase performed** |

---

## 2. Existing seeding directory assessment

Phase 3G already occupies `src/features/competition-core/seeding/**` (`contracts/`, `services/`, `errors/runtime*`, `SeedingResolver`, adapters, mappers).

Phase 1C **adapted** the tree:

- Added `domain/` (new)
- Extended `policies/`, `services/`, `errors/`, capability `index.js`
- Did **not** delete or rewrite Phase 3G runtime behaviour
- Did **not** change `seedEngine.generateSeed`, `assignSeedsToEntries`, `teamGroupSeedEngine`, CC-04B `seed/**`, UI, or tournament-format code

---

## 3. Path deviations from doc 15 sketch

Doc 15 suggested logical modules such as `domain/SeedingScope.js` and `errors/reasonCodes.js`. Owner Phase 1C preferred normalize-oriented filenames. Used:

| Implemented | Doc 15 sketch |
|-------------|---------------|
| `errors/seedingErrorCodes.js` | `errors/reasonCodes.js` |
| `errors/SeedingDomainError.js` | `errors/SeedingError.js` |
| `domain/normalizeSeedingScope.js` | `domain/SeedingScope.js` |
| `domain/normalizeSeedingCandidate(s).js` | `domain/SeedingCandidate.js` |
| `policies/normalizeSeedingPolicy.js` | same |
| `policies/normalizeTieBreakSequence.js` | (implied) |
| `services/buildCandidateOrderingTuple.js` | (implied under comparator) |
| `services/createDeterministicCandidateComparator.js` | `services/deterministicComparator.js` |

No second parallel package path was created.

---

## 4. Source files created

### Errors
- `src/features/competition-core/seeding/errors/seedingErrorCodes.js`
- `src/features/competition-core/seeding/errors/SeedingDomainError.js`

### Domain
- `src/features/competition-core/seeding/domain/constants.js`
- `src/features/competition-core/seeding/domain/deepFreeze.js`
- `src/features/competition-core/seeding/domain/normalizeHelpers.js`
- `src/features/competition-core/seeding/domain/normalizeSeedingScope.js`
- `src/features/competition-core/seeding/domain/normalizeSeedingCandidate.js`
- `src/features/competition-core/seeding/domain/normalizeSeedingCandidates.js`
- `src/features/competition-core/seeding/domain/index.js`

### Policies
- `src/features/competition-core/seeding/policies/normalizeSeedingPolicy.js`
- `src/features/competition-core/seeding/policies/normalizeTieBreakSequence.js`

### Services
- `src/features/competition-core/seeding/services/buildCandidateOrderingTuple.js`
- `src/features/competition-core/seeding/services/createDeterministicCandidateComparator.js`

### Tests / docs / CI
- `tests/competition-core-seeding-core07.test.js`
- `docs/competition-engine/core-07/17_PHASE_1C_DOMAIN_FOUNDATION_REPORT.md` (this file)
- `docs/competition-engine/core-07/README.md` (status link only)
- `scripts/ci/unit-test-files.json` (register Phase 1C test)

### Modified barrels (additive only)
- `src/features/competition-core/seeding/index.js`
- `src/features/competition-core/seeding/errors/index.js`
- `src/features/competition-core/seeding/policies/index.js`
- `src/features/competition-core/seeding/services/index.js`

---

## 5. Domain implementation summary

### SeedingScope
- Requires `competitionId`, `entryType`
- Requires at least one of `divisionId` / `categoryId`
- Optional `competitionVersionId`, `stageId`
- Strips provenance (`policyId`, `policyVersion`, `snapshotId`, `resultVersion`, `requestId`, fingerprint) from identity
- Emits `INVALID_SCOPE` on malformed/ambiguous boundary

### SeedingCandidate
- Requires `entryId`, `stableCanonicalId`, `subjectRef`, `entryType`, eligibility fields
- Preserves zero ranking/rating values
- Absent / null / empty optional numerics remain missing
- Present NaN / ±Infinity / unsupported types → `INVALID_CANDIDATE` (never coerced to missing)
- Missing-value ordering applies only to genuinely missing values
- Timestamps: epoch ms or ISO-8601 UTC with `Z` only
- Does not mutate caller input; outputs deep-frozen
- Opaque IDs trimmed only (no case-fold)

### Owner numeric remediation (post Phase 1C review)

Corrected defect: non-finite present numerics were previously coerced to missing. Required semantics now:

| Input | Result |
|-------|--------|
| absent / `null` / `""` | missing (`null`) |
| `0` | preserved `0` |
| `NaN` / `Infinity` / `-Infinity` | `INVALID_CANDIDATE` |
| unsupported present type | `INVALID_CANDIDATE` |

### Candidate collection
- Duplicate `entryId` / `stableCanonicalId` → `DUPLICATE_CANDIDATE` fail-closed
- No silent deduplication

### SeedingPolicy (ordering subset)
- Validates `policyId`, `policyVersion`, primary source, direction, missing-value mode, tie-break sequence
- Auto-appends final `stableCanonicalId` when absent; rejects mid-sequence placement
- `POLICY_REQUIRED` / `POLICY_VERSION_MISMATCH` / `INVALID_TIE_BREAK`

### Deterministic comparator (`core07-compare-v1`)
- Primary → configured tie-breaks → missing-value handling → mandatory `stableCanonicalId`
- Number / string (UTF-16 code units) / timestamp compares
- Mixed timestamp forms → `NON_DETERMINISTIC_INPUT`
- No `Math.random`, `Date.now`, `localeCompare`, or input-array final tie-break

---

## 6. Comparator correctness evidence (tests)

| Property | Evidence |
|----------|----------|
| Reflexivity | `compare(A,A) === 0` |
| Antisymmetry | `sign(cmp(A,B)) === -sign(cmp(B,A))` |
| Transitivity | `A<B` and `B<C` ⇒ `A<C` |
| Total order | Distinct candidates never compare `0` after final ID |
| Permutation independence | Shuffled inputs → identical sorted `entryId` sequence |

---

## 7. Explicitly not implemented (Owner Phase 1C limit)

- Seed-number allocation / full `SeedAssignment` generation
- Manual override execution / state transitions
- Result finalization / superseding / fingerprinting
- Rule Engine / Eligibility adapters
- Ranking/rating calculation
- Legacy production adapters / UI / SQL / feature flags / root export

---

## 8. Test commands and results

```text
node --test tests/competition-core-seeding-core07.test.js
→ (Phase 1C + numeric remediation) pass

node --test tests/competition-core-seeding-runtime-3g.test.js
→ 22 pass / 0 fail

Broader suites importing competition-core/index.js:
→ attempt only if @supabase/supabase-js already present; do not install packages.
```

---

## 9. Proposed Phase 1D scope

Increment toward assignment runtime under frozen contracts:

1. Seed-number allocation over deterministic order (unique positive seeds; `maximumSeededEntries`)
2. Override validation + slot reservation (no silent conflicts)
3. Result assembly (`orderedAssignments`, excluded, rejectedOverrides) without production wiring
4. Deterministic fingerprint (exclude `generatedAt`)
5. Port interface stubs (EligibilityDecisionPort / RuleEvaluationPort) fail-closed when required

Still out until Owner gates: root export, feature flags, SQL, legacy engine cutover, Draw placement.
