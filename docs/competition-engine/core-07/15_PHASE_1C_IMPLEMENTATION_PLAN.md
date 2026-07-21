# CORE-07 — Phase 1C Implementation Plan

**Phase:** 1B → 1C handoff (plan only)
**Status:** **Do not create** source or test files in Phase 1B

---

## 1. Objective of Phase 1C

Implement canonical CORE-07 domain foundation **inside** `src/features/competition-core/seeding/**`, conforming to Phase 1B contracts, still **non-production**:

- No root `competition-core/index.js` export
- No feature-flag ON
- No SQL
- No legacy engine deletion
- No CC-04B rewrite

---

## 2. Proposed source layout

Prefer adapting the existing Phase 3G tree:

```text
src/features/competition-core/seeding/
  domain/                 # NEW or evolved from contracts/
    SeedingScope.js
    SeedingCandidate.js
    SeedingPolicy.js
    RankingRatingSnapshot.js
    ManualSeedOverride.js
    SeedAssignment.js
    SeedingResult.js
    DeterministicContext.js
    validation.js
  policies/
    normalizeSeedingPolicy.js
    noopSeedingPolicy.js          # test double only
  ports/
    eligibilityDecisionPort.js
    ruleEvaluationPort.js
    seedingPersistencePort.js     # keep OFF default
  services/
    normalizeRequest.js
    deterministicComparator.js    # core07-compare-v1
    assignSeeds.js
    validateOverrides.js
    fingerprintResult.js
    finalizeResult.js             # state transition helpers only
  errors/
    reasonCodes.js
    SeedingError.js
  index.js                        # capability-local exports
```

Exact file split may consolidate with existing `contracts/` during adaptation; the **logical** modules above are mandatory. Avoid a second parallel package path.

---

## 3. Proposed test location

```text
tests/competition-core-seeding-core07.test.js
```

Optional later split files (Owner/CI style):

```text
tests/competition-core-seeding-core07-*.test.js
```

Do **not** remove Phase 3G tests until parity is proven and Owner approves.

---

## 4. Reviewable increments

### Increment 1 — Domain value objects and validation

- Implement `SeedingScope` as competition-boundary identity only (no `policyId` / `policyVersion` on scope key)
- Candidate normalization, request immutability copies
- Enforce mandatory fields; emit `INVALID_*` / `MISSING_STABLE_IDENTIFIER` / `DUPLICATE_CANDIDATE`
- **Exit criteria:** pure functions; no ports required yet

### Increment 2 — Policy normalization

- Normalize versioned `SeedingPolicy` as request/result provenance (not scope identity)
- Validate primary source, tie-break sequence, missing-value mode
- Detect `POLICY_REQUIRED` / `POLICY_VERSION_MISMATCH` / `INVALID_TIE_BREAK`
- Policy/snapshot change under same scope → new result version path (wired in later increments)
- **Exit criteria:** policy normalize pure; distinguishes invariants vs configurable fields; scope key excludes policy

### Increment 3 — Deterministic comparator

- Implement `core07-compare-v1` total order
- Primary + tie-break sequence + missing-value + `stableCanonicalId`
- Comparator may return `0` only for the same canonical identity (`compare(A,A)===0`); distinct validated candidates must be non-zero after final ID compare; duplicate `stableCanonicalId` rejected before sort
- Enforce reflexive / antisymmetric / transitive properties in tests
- **Exit criteria:** shuffled input arrays → identical order; algebraic properties hold

### Increment 4 — Seed assignment service

- Override slot reservation + free number fill
- Respect `maximumSeededEntries`, `seedNumberStart`
- Exclude ineligible
- **Exit criteria:** unique positive seeds; invariants hold

### Increment 5 — Override conflict validation

- Actions: `ASSIGN` | `PROTECT` | `CLEAR` only; status: `PENDING` | `ACCEPTED` | `REJECTED` | `SUPERSEDED` | `CANCELLED`
- Duplicate seed, duplicate entry override, OOR, ineligible, unauthorized, finalized (including CLEAR)
- Populate `rejectedOverrides` with retained audit fields; no silent resolution; rejected must not mutate assignments
- **Exit criteria:** conflict matrix from doc 12 covered by tests (Phase 1C)

### Increment 6 — Result fingerprinting

- Canonical JSON + stable hash
- Exclude `generatedAt` from assignment fingerprint
- **Exit criteria:** re-run equivalence

### Increment 7 — Port interfaces

- `EligibilityDecisionPort` + `RuleEvaluationPort` stubs + contract versions
- Fail closed when required
- **Exit criteria:** no deep `constraints/**` imports from seeding

### Increment 8 — Exports

- Capability-local `seeding/index.js` only
- Explicit deny: root barrel, CI manifest merge, feature flags
- **Exit criteria:** grep/CI guard or checklist confirmation

### Increment 9 — Tests

- Author `tests/competition-core-seeding-core07.test.js` per `16_PHASE_1C_TEST_MATRIX.md`
- **Exit criteria:** matrix rows green for implemented increments

---

## 5. Explicit non-work in Phase 1C

| Item | Status |
|------|--------|
| Production UI wiring | Out |
| Legacy `seedEngine` / `assignSeedsToEntries` / `teamGroupSeedEngine` edits | Out |
| CC-04B `seed/**` merge | Out |
| Draw/snake implementation | Out |
| SQL / RPC | Out |
| Push / PR / deploy | Owner-gated outside 1C coding unless requested |

---

## 6. Adaptation rule for Phase 3G

When existing Phase 3G behaviour conflicts with Phase 1B contracts, **contracts win**. Document deviations in the Phase 1C PR/description. Do not preserve noop eligibility as the production default path.

---

## 7. Suggested Phase 1C commit policy

Only when Owner requests commits: small commits per increment 1→9; docs already landed in 1B.
