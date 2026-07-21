# CORE-07 — Phase 1C Test Matrix

**Phase:** 1B Architecture Freeze (matrix design only)
**Planned test file:** `tests/competition-core-seeding-core07.test.js`
**Status:** **Do not create tests in Phase 1B**

---

## 1. Test principles

1. Fixed clocks / explicit `effectiveAt` / `generatedAt` — never rely on wall-clock.
2. Shuffle input candidate arrays and assert identical assignments + fingerprint.
3. No `Math.random` in CORE-07 path under test.
4. Port doubles are injected; fail-closed cases asserted.
5. Separate cases for validation errors vs exclusions vs rejected overrides vs warnings.
6. Comparator algebraic properties: reflexive, antisymmetric, transitive.

---

## 2. Matrix

| ID | Area | Scenario | Expected |
|----|------|----------|----------|
| T01 | Domain | Missing `competitionId` in scope | `INVALID_SCOPE` |
| T02 | Domain | Missing `stableCanonicalId` | `MISSING_STABLE_IDENTIFIER` |
| T03 | Domain | Duplicate `entryId` | `DUPLICATE_CANDIDATE` fail closed |
| T04 | Domain | Duplicate `stableCanonicalId` | `DUPLICATE_CANDIDATE` fail closed **before** assignment/sort |
| T05 | Domain | Non-finite rating coerced | Treated as missing per policy |
| T06 | Policy | Missing policy | `POLICY_REQUIRED` |
| T07 | Policy | Conflicting policy version declarations on request | `POLICY_VERSION_MISMATCH` |
| T08 | Policy | Unknown tie-break field | `INVALID_TIE_BREAK` |
| T09 | Compare | Ranking ASC primary | Lower rank → better seed |
| T10 | Compare | Rating DESC primary | Higher rating → better seed |
| T11 | Compare | Missing values SORT_LAST | Present values precede missing |
| T12 | Compare | Full tie → stableCanonicalId | Total order; never unstable |
| T13 | Compare | Input array shuffled | Identical orderedAssignments |
| T14 | Compare | String compare without localeCompare | Code-unit order stable |
| T15 | Compare | Timestamp mixed forms | `NON_DETERMINISTIC_INPUT` / invalid |
| T16 | Assign | Seeds unique positive integers within scope | Invariant hold |
| T17 | Assign | One entry one assignment | Invariant hold |
| T18 | Assign | `maximumSeededEntries` | Remainder in eligibleUnseeded |
| T19 | Assign | Ineligible never assigned | `ENTRY_INELIGIBLE` excluded |
| T20 | Override | Two overrides same seed number | Both `REJECTED` / fail; no silent pick |
| T21 | Override | Two ASSIGN for one entry | Conflict → `REJECTED` / `OVERRIDE_CONFLICT` |
| T22 | Override | Out-of-range seed | `status: REJECTED` |
| T23 | Override | Override on ineligible | `REJECTED` + `ENTRY_INELIGIBLE` |
| T24 | Override | Unauthorized ASSIGN | `status: REJECTED` + `OVERRIDE_UNAUTHORIZED`; no assignment mutation |
| T25 | Override | Manual ACCEPTED reserves slot; auto fills gaps | Correct free-number fill |
| T26 | Fingerprint | Same inputs twice | Same fingerprint; may differ `generatedAt` |
| T27 | Fingerprint | `generatedAt` change only | Fingerprint unchanged |
| T28 | Fingerprint | Policy version change | Fingerprint changes; **same** `SeedingScope` |
| T29 | Ports | Eligibility required missing | `ELIGIBILITY_REQUIRED` |
| T30 | Ports | Eligibility INELIGIBLE | Excluded; not assigned |
| T31 | Ports | Rule port required but fails | `INTERNAL_PORT_FAILURE` |
| T32 | Finalization | Finalize DRAFT | State FINALIZED; immutable |
| T33 | Finalization | Mutate after finalize | `RESULT_FINALIZED` |
| T34 | Finalization | Supersede | New version; prior SUPERSEDED |
| T35 | Finalization | Finalize idempotent | Same fingerprint OK |
| T36 | Snapshot | Required snapshot missing | `SNAPSHOT_REQUIRED` |
| T37 | Snapshot | Incomplete + FAIL policy | `SNAPSHOT_INCOMPLETE` |
| T38 | Prohibited | Guard/regression: no Math.random in assign path | Static or behavioural |
| T39 | Prohibited | No internal Date.now in assign path | Behavioural with fake timers unused |
| T40 | Compatibility | Phase 3G-shaped fixture adapted | Maps to CORE-07 result or documented delta |
| T41 | Compare | `compare(candidate, candidate)` | Returns `0` (reflexive) |
| T42 | Compare | Two distinct candidates | Never compare as `0` after final ID |
| T43 | Compare | Duplicate `stableCanonicalId` | Fails validation before assignment (`DUPLICATE_CANDIDATE`) |
| T44 | Compare | Antisymmetry | `cmp(A,B)<0` ⇒ `cmp(B,A)>0` |
| T45 | Compare | Transitivity | `A≤B` and `B≤C` ⇒ `A≤C` |
| T46 | Scope | Same scope + new policy version | New `resultVersion` (not new scope) |
| T47 | Scope | New result after policy change | Prior authoritative result → `SUPERSEDED` |
| T48 | Scope | Policy change | Does **not** create a second authoritative scope |
| T49 | Scope | Seed uniqueness | Evaluated within competition `SeedingScope` |
| T50 | Scope / Draw | Downstream Draw | Receives one authoritative finalized result per scope |
| T51 | Override | Unauthorized ASSIGN | Becomes `REJECTED` (action remains ASSIGN) |
| T52 | Override | Conflicting ASSIGN | Becomes `REJECTED` |
| T53 | Override | CLEAR after finalization | Becomes `REJECTED` + `RESULT_FINALIZED` |
| T54 | Override | Superseded override | Remains auditable (`status: SUPERSEDED`) |
| T55 | Override | Rejected override | Does **not** mutate assignments |

---

## 3. Coverage mapping to increments

| Increment | Primary tests |
|-----------|---------------|
| 1 Domain VO | T01–T05, T43, T49 |
| 2 Policy | T06–T08, T46–T48 |
| 3 Comparator | T09–T15, T41–T45 |
| 4 Assignment | T16–T19, T25, T49 |
| 5 Overrides | T20–T25, T51–T55 |
| 6 Fingerprint | T26–T28 |
| 7 Ports | T29–T31, T36–T37 |
| 8 Exports | Manual/CI checklist (no accidental root export) |
| 9 Full matrix | T01–T55 as implemented; T50 integration-style or contract assertion |

---

## 4. Out of scope for Phase 1C tests

- Legacy TE / team engine integration tests (later adapter phase)
- CC-04B score pipeline parity (deferred Owner decision)
- Draw/snake/open shuffle implementation (T50 is a contract assertion / handoff check only)
- Supabase / UI e2e
- Production feature-flag on

---

## 5. Note

This matrix is a **plan**. Creating `tests/competition-core-seeding-core07.test.js` is a Phase 1C task.
