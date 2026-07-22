# CORE-13 — Phase 1F Final Certification

**Capability:** Referee Assignment
**Branch:** `feature/competition-core-13-referee-assignment`
**Digest:** `CORE13_DIGEST_SHA256_V1` (capability-local pure SHA-256)
**Schema:** `CORE13_REFEREE_ASSIGNMENT_SCHEMA_V1`

---

## 1. Safety baseline

- Workspace: `competition-core-13-referee-assignment`
- Branch synced with `origin/main` (ff-only when behind; no rebase)
- Local changes limited to authorized CORE-13 paths
- No upstream CORE-13 path collision

---

## 2. SHA-256 known-answer and oracle results

Production `sha256HexUtf8` compared to independent `node:crypto` oracle for:

| Vector | Result |
|--------|--------|
| empty string | PASS |
| `abc` | PASS |
| quick brown fox | PASS |
| multi-block ASCII (>64) | PASS |
| Vietnamese Unicode | PASS |
| combining character `e`+U+0301 | PASS |
| emoji / supplementary plane | PASS |
| lengths 55,56,63,64,65,127,128,129 | PASS |

Production module: **no** `node:crypto`, **no** browser crypto globals.

---

## 3. UTF-8 semantics

1. Canonical serialization → JavaScript string
2. Digest encodes via `TextEncoder` UTF-8 bytes
3. Matches standard UTF-8 / TextEncoder semantics
4. No Windows code page / locale / timezone dependence
5. **No** silent NFC/NFD/NFKC/NFKD normalization
6. Code-point-distinct strings remain distinct (`e\u0301` ≠ `\u00e9`)
7. Malformed surrogates follow TextEncoder replacement behavior
8. `displayLabel` excluded from authoritative planner fingerprints

---

## 4. Canonicalization certification

Object key order irrelevant; set-like arrays normalized by stable sort before digest; contractually ordered arrays remain order-sensitive; rejects undefined/functions/Date/Map/Set/Symbol/BigInt/NaN/±Infinity/cycles; `-0` → `0`; inputs not mutated; repeated runs byte-equivalent.

---

## 5. Domain-separation inventory

All values in `CORE13_DIGEST_DOMAIN` are unique and versioned, including:

- ASSIGNMENT, PLAN, PLAN_FINGERPRINT
- REPLACEMENT, REPLACEMENT_RESULT, AUDIT
- SNAPSHOT: DIRECTORY, QUALIFICATION, AVAILABILITY, EXISTING_ASSIGNMENT, SCHEDULE, CONFLICT_POLICY, WORKLOAD_HISTORY

Same payload under different domains → different digests.

---

## 6. ID format certification

| Prefix | Use |
|--------|-----|
| `core13_assignment_v1_` | assignmentId |
| `core13_plan_v1_` | planId |
| `core13_replacement_v1_` | replacement identity |
| `core13_audit_v1_` | audit identity |

Truncation ≥128 bits (32 hex). Full fingerprints = 64 lowercase hex. No timestamps/random/display labels/ranking position in IDs.

---

## 7. Replay certification

Fixed scenarios (one match, multi-match, multi-role, empty directory, seeded, replacement success/reject, shuffled directory) replayed **≥25** times with byte-equivalent `serializeCanonical` results and identical IDs/fingerprints.

---

## 8. Failure and recoverability matrix

| Class | Examples |
|-------|----------|
| Fatal | malformed request, missing/invalid snapshot, conflicting duplicates, unsupported objective, required seed missing, non-deterministic input |
| Recoverable | empty directory, no eligible referee, missing match window, mandatory/optional unfilled, capacity exhaustion, candidate conflict |

Recoverable match gaps do not abort unrelated assignable matches.

---

## 9. Input immutability certification

All seven public operations preserve input/snapshot/policy immutability; public outputs deeply frozen.

---

## 10. Architecture dependency scan

No production imports of React, Supabase, referee-v5, legacy referee engines, court-engine dispatch, CORE-14, Schedule/Court/Match Lifecycle/scoring private implementations, `node:crypto`, browser crypto, network, or persistence.

No `Math.random` / `Date.now` / `randomUUID` / `localeCompare` / FNV constants / authoritative 32-bit hashing.

---

## 11–15. Integration boundaries

| Boundary | CORE-13 role | Must not |
|----------|--------------|----------|
| Schedule Engine | Consume immutable schedule snapshot via ports | Generate/change/persist schedule; import Schedule private impl |
| Court Assignment | Opaque `courtId` / courtRef for soft objectives | Allocate or change courts |
| CORE-14 Resource Conflict | Own referee conflict facts + opaque projections | Import CORE-14; own cross-resource resolve |
| Match Lifecycle | Downstream consumer of assignment refs/status | Transition matches / scoring / live sessions |
| Referee portal | Out of scope | Own auth/profile identity |

Match Lifecycle is **not** labelled CORE-14.

---

## 16. Focused test results

See Phase 1F report section P — all Phase 1B–1F focused suites must pass.

---

## 17. Exact final changed-file manifest

Authorized only:

- `src/features/competition-core/referee-assignment/**`
- `docs/competition-engine/core-13/**`
- `tests/competition-core-referee-assignment-core13-phase1{b,c,d,e,f}.test.js`

---

## 18. Controlled-commit recommendation

**Ready for controlled commit** after Owner approval.

Proposed subject:

```text
feat(competition-core): add referee assignment capability
```

Do **not** include root barrel, adapters, persistence, UI, SQL, or deployment files.

See Phase 1F report section S for the exact staging manifest (prepare-only; no stage/commit in Phase 1F).
