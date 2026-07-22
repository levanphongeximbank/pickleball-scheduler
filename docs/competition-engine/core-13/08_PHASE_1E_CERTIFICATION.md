# CORE-13 — Phase 1E Certification

**Module:** `src/features/competition-core/referee-assignment/`
**Digest:** `CORE13_DIGEST_SHA256_V1` (pure SHA-256, capability-local)
**Schema:** `CORE13_REFEREE_ASSIGNMENT_SCHEMA_V1`

---

## 1. Fingerprint primitive audit

| Option | Result |
|--------|--------|
| Shared Competition Core SHA-256 public utility | **Not found** — CORE-09/10/11/12 use FNV-1a locally |
| Import product digests (`team-tournament`, rating-v5) | **Rejected** — boundary violation |
| Import other CORE private fingerprint paths | **Rejected** |
| Capability-local pure SHA-256 | **Adopted** — `deterministic/fingerprint.js` |

Authoritative IDs and fingerprints **must not** use FNV-1a / 32-bit hashes.

---

## 2. Canonical serialization

`canonicalizeJsonValue` / `serializeCanonical`:

- Sort object keys with `compareStableString`
- Preserve explicitly canonical array order; set-like arrays stable-sorted before digest
- Reject `undefined`, functions, Date, Map, Set, Symbol, BigInt, NaN, ±Infinity
- No locale / host timezone / wall-clock generation
- Byte-equivalent for semantically equivalent normalized inputs

---

## 3. Digest and ID formats

| Kind | Format |
|------|--------|
| Full fingerprints | lowercase hex, **64** chars (SHA-256) |
| `assignmentId` | `core13_assignment_v1_` + ≥128-bit hex (32 chars) |
| `planId` | `core13_plan_v1_` + ≥128-bit hex |
| Replacement identity | `core13_replacement_v1_` + ≥128-bit hex |
| Audit identity | `core13_audit_v1_` + ≥128-bit hex |

Domain separation markers include `CORE13:ASSIGNMENT:V1`, `CORE13:PLAN_FINGERPRINT:V1`, `CORE13:REPLACEMENT_RESULT:V1`, snapshot domains, etc.

---

## 4. Fairness workload cohort

`populationSize` / `fairnessScale` / `workloadCohortSize` =

distinct **active** valid directory candidates in request scope after deterministic dedupe.

**Include:** active candidates (even if unavailable / unqualified / excluded for a single match).
**Exclude:** inactive, malformed, out-of-scope, conflicting duplicate `refereeId`.

```text
fairnessDelta = abs(activeAssignmentCount * fairnessScale - totalActiveAssignmentCount)
```

---

## 5. Duplicate snapshot semantics

| Snapshot | Identical normalized duplicates | Conflicting same identity |
|----------|----------------------------------|---------------------------|
| Directory | Deduped deterministically | Fatal `NON_DETERMINISTIC_INPUT` |
| Schedule | Deduped deterministically | Fatal |
| Qual / avail / existing / history | Documented as input-stable; planner fingerprints sort-canonicalized | Conflicting same natural key treated as fatal where validated |

No last-write-wins on input order.

---

## 6. Seed certification

| Case | Behavior |
|------|----------|
| Seed absent, not required | Deterministic non-seeded |
| Seed present, exploration disabled | Seed ignored (no result / fingerprint effect) |
| Seed present, exploration enabled | Same seed → same result |
| Different seeds | May change eligible tie-break only |
| Seed never bypasses hard eligibility | Enforced |
| `requireSeed` + missing | Fatal |
| Invalid seed type | Fatal `NON_DETERMINISTIC_INPUT` |

---

## 7. Phase 1D requirements 1–58 traceability

| # | Requirement summary | Test file | Exact test name | Result |
|---|---------------------|-----------|-----------------|--------|
| 1 | fairnessDelta symmetric [1,2] | phase1d | P1C-1: fairnessDelta symmetric for counts [1,2] | PASS |
| 2 | fairnessScale exposed | phase1d | P1C-1: fairnessDelta symmetric for counts [1,2] | PASS |
| 3 | Team affiliation not hard by default | phase1d | P1C-2: team affiliation not hard by default; hard when flagged | PASS |
| 4 | Team affiliation hard when flagged | phase1d | P1C-2: team affiliation not hard by default; hard when flagged | PASS |
| 5 | Club affiliation policy-gated | phase1d | P1C-3: club and org affiliation policy-gated; self-referee denied | PASS |
| 6 | Organization affiliation policy-gated | phase1d | P1C-3: club and org affiliation policy-gated; self-referee denied | PASS |
| 7 | Self-referee denied by default | phase1d | P1C-3: club and org affiliation policy-gated; self-referee denied | PASS |
| 8 | Soft notes use RefereeSoftNoteCode | phase1d | P1C-4: soft notes use stable enum codes | PASS |
| 9 | Fill single mandatory PRIMARY | phase1d | P1D-1: fills single mandatory PRIMARY slot | PASS |
| 10 | Multiple matches deterministic | phase1d | P1D-2: multiple matches deterministic; shuffle-invariant fingerprint | PASS |
| 11 | Multiple roles on one match | phase1d | P1D-3: multiple roles; same referee blocked by default; allowed when enabled | PASS |
| 12 | Mandatory before optional | phase1d | P1D-12: mandatory before optional; refereeId final tie-break | PASS |
| 13 | Same referee two roles blocked | phase1d | P1D-3: multiple roles; same referee blocked by default; allowed when enabled | PASS |
| 14 | Multi-role when enabled | phase1d | P1D-3: multiple roles; same referee blocked by default; allowed when enabled | PASS |
| 15 | ANY emits concrete role | phase1d | P1D-4: ANY requirement emits concrete role | PASS |
| 16 | ANY never emitted as roleCode | phase1d | P1D-1 / P1D-4 | PASS |
| 17 | Invalid concrete ANY rejected | phase1d | P1D-15: replacement… (ANY reject) + phase1c M05 | PASS |
| 18 | Ineligible never soft-ranked | phase1d | P1D-14: ineligible excluded; max simultaneous; slot ids differ | PASS |
| 19 | Lower workload preferred | phase1d | P1D-5: lower workload preferred; newly planned blocks overlap | PASS |
| 20 | Consecutive-match objective | phase1d | P1D-13: objective order and consecutive/court/role preferences | PASS |
| 21 | Court-transition objective | phase1d | P1D-13: objective order and consecutive/court/role preferences | PASS |
| 22 | Role preference objective | phase1d | P1D-13: objective order and consecutive/court/role preferences | PASS |
| 23 | Objective order changes result | phase1d | P1D-13: objective order and consecutive/court/role preferences | PASS |
| 24 | refereeId final non-seeded tie-break | phase1d | P1D-12: mandatory before optional; refereeId final tie-break | PASS |
| 25 | Shuffle → identical assignments | phase1d | P1D-2: multiple matches deterministic; shuffle-invariant fingerprint | PASS |
| 26 | Shuffle → identical planFingerprint | phase1d | P1D-2: multiple matches deterministic; shuffle-invariant fingerprint | PASS |
| 27 | Decision change changes planFingerprint | phase1d | P1D-8: decision change changes fingerprint; assignment ids stable | PASS |
| 28 | displayLabel does not change fingerprint | phase1d | P1D-7: missing match window recoverable; displayLabel ignored in fingerprint | PASS |
| 29 | Empty directory → unassigned plan | phase1d | P1D-6: empty directory valid plan with unassigned; missing snapshot fatal | PASS |
| 30 | One unassignable match does not abort others | phase1d | P1D-7: missing match window recoverable; displayLabel ignored in fingerprint | PASS |
| 31 | Missing snapshot fatal | phase1d | P1D-6: empty directory valid plan with unassigned; missing snapshot fatal | PASS |
| 32 | Invalid snapshot fatal | phase1d | P1D-6: empty directory valid plan with unassigned; missing snapshot fatal | PASS |
| 33 | Missing schedule window recoverable | phase1d | P1D-7: missing match window recoverable; displayLabel ignored in fingerprint | PASS |
| 34 | Newly planned prevents overlap | phase1d | P1D-5: lower workload preferred; newly planned blocks overlap | PASS |
| 35 | Newly planned affects workload | phase1d | P1D-5: lower workload preferred; newly planned blocks overlap | PASS |
| 36 | max simultaneous enforced | phase1d | P1D-14: ineligible excluded; max simultaneous; slot ids differ | PASS |
| 37 | Deterministic assignmentId stable | phase1d | P1D-8: decision change changes fingerprint; assignment ids stable | PASS |
| 38 | Assignment IDs differ by slot facts | phase1d | P1D-14: ineligible excluded; max simultaneous; slot ids differ | PASS |
| 39 | planId stable | phase1d | P1D-2: multiple matches deterministic; shuffle-invariant fingerprint | PASS |
| 40 | No Math.random / Date.now / randomUUID / localeCompare | phase1d | P1D-11: architecture guards | PASS |
| 41 | Replacement succeeds | phase1d | P1D-9: replacement success and audit without recordedAt | PASS |
| 42 | Replacement ignores outgoing for target overlap | phase1d | P1D-15: replacement overlap isolation; causedBy preserved; fingerprint ignores sink time | PASS |
| 43 | Replacement does not ignore unrelated | phase1d | P1D-15: replacement overlap isolation; causedBy preserved; fingerprint ignores sink time | PASS |
| 44 | Same referee replacement rejected | phase1d | P1D-10: replacement rejects same referee, missing, RELEASED, REPLACED | PASS |
| 45 | Missing assignment rejected | phase1d | P1D-10: replacement rejects same referee, missing, RELEASED, REPLACED | PASS |
| 46 | RELEASED rejected | phase1d | P1D-10: replacement rejects same referee, missing, RELEASED, REPLACED | PASS |
| 47 | REPLACED rejected | phase1d | P1D-10: replacement rejects same referee, missing, RELEASED, REPLACED | PASS |
| 48 | Preserves role and match | phase1d | P1D-9: replacement success and audit without recordedAt | PASS |
| 49 | Incoming source REPLACEMENT | phase1d | P1D-9: replacement success and audit without recordedAt | PASS |
| 50 | causedBy + reasonCodes preserved | phase1d | P1D-15: replacement overlap isolation; causedBy preserved; fingerprint ignores sink time | PASS |
| 51 | Audit payload no recordedAt | phase1d | P1D-9: replacement success and audit without recordedAt | PASS |
| 52 | Fingerprint ignores sink timestamp | phase1d | P1D-15: replacement overlap isolation; causedBy preserved; fingerprint ignores sink time | PASS |
| 53 | Public outputs deeply immutable | phase1d | P1D-8: decision change changes fingerprint; assignment ids stable | PASS |
| 54 | Phase 1B tests remain green | phase1b + combined | all Phase 1B tests | PASS |
| 55 | Phase 1C tests remain green | phase1c + combined | all Phase 1C tests | PASS |
| 56 | Capability-local index exports only approved surface | phase1d | P1D-11: architecture guards | PASS |
| 57 | Root competition-core/index.js unchanged | phase1d | P1D-11: architecture guards | PASS |
| 58 | No React/Supabase/referee-v5/legacy/CORE-14 imports | phase1d | P1D-11: architecture guards | PASS |

---

## 8. Phase 1E additional certification coverage

Covered in `tests/competition-core-referee-assignment-core13-phase1e.test.js` (digest format, domain separation, cohort, duplicates, seed modes, fingerprints).

---

## 9. Deferred

Persistence, adapters, UI/portal, root barrel integration, Schedule/Court/Match Lifecycle, CORE-14 resolver.
