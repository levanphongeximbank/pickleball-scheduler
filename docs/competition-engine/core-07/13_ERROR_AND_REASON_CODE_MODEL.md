# CORE-07 — Error and Reason Code Model

**Phase:** 1B Architecture Freeze
**Status:** Contract design only — no production implementation

---

## 1. Purpose

Freeze a clear separation between validation failures, business exclusions, rejected overrides, warnings, and infrastructure failures.

---

## 2. Categories

| Category | Fail request? | Appear on result? | Examples |
|----------|---------------|-------------------|----------|
| **Validation errors** | Yes (typical) | May also list | `INVALID_REQUEST`, `INVALID_SCOPE`, `DUPLICATE_CANDIDATE` |
| **Business exclusions** | No (entry-level) | `excludedEntries` | `ENTRY_INELIGIBLE` |
| **Rejected overrides** | Policy-dependent | `rejectedOverrides` (`status: REJECTED`; action remains ASSIGN/PROTECT/CLEAR; no assignment mutation) | `OVERRIDE_CONFLICT`, `OVERRIDE_UNAUTHORIZED` |
| **Warnings** | No | `warnings` | Soft rule warnings, partial snapshot accepted |
| **Infrastructure failures** | Yes | Error channel | `INTERNAL_PORT_FAILURE` |

---

## 3. Required codes (minimum set)

| Code | Category | Meaning |
|------|----------|---------|
| `INVALID_REQUEST` | Validation | Malformed request / missing requestId / immutable contract violation |
| `INVALID_SCOPE` | Validation | Incomplete or inconsistent `SeedingScope` |
| `DUPLICATE_CANDIDATE` | Validation | Duplicate entryId or stableCanonicalId |
| `INVALID_CANDIDATE` | Validation | Candidate fails normalization |
| `ELIGIBILITY_REQUIRED` | Validation / fail-closed | Required eligibility decision missing or UNKNOWN |
| `ENTRY_INELIGIBLE` | Business exclusion | Entry not eligible for seeding |
| `SNAPSHOT_REQUIRED` | Validation | Snapshot missing when required |
| `SNAPSHOT_INCOMPLETE` | Validation or warning* | Completeness below policy (*FAIL vs warn per policy) |
| `POLICY_REQUIRED` | Validation | Policy missing |
| `POLICY_VERSION_MISMATCH` | Validation | Conflicting policy version declarations on the same request (policy is provenance, not scope identity) |
| `INVALID_TIE_BREAK` | Validation | Unknown/illegal tie-break sequence entry |
| `MISSING_STABLE_IDENTIFIER` | Validation | `stableCanonicalId` absent |
| `DUPLICATE_SEED_NUMBER` | Rejected override / validation | Two claimants for one seed number |
| `OVERRIDE_CONFLICT` | Rejected override | Competing overrides / supersession violation |
| `OVERRIDE_UNAUTHORIZED` | Rejected override | Actor not allowed |
| `RESULT_FINALIZED` | Validation | Mutation attempted on finalized result |
| `NON_DETERMINISTIC_INPUT` | Validation | Wall-clock / unstable / mixed timestamp forms / missing compare contract |
| `INTERNAL_PORT_FAILURE` | Infrastructure | Eligibility or Rule port failed |

\* When policy `missingValueBehaviour === FAIL` or snapshot completeness is mandatory, treat incomplete snapshot as validation error; when PARTIAL is allowed, emit warning codes and apply missing-value ordering.

---

## 4. Error object shape (logical)

```text
SeedingError {
  code: string                  // from table above (or namespaced extension)
  category: "VALIDATION" | "BUSINESS_EXCLUSION" | "REJECTED_OVERRIDE" | "WARNING" | "INFRASTRUCTURE"
  message?: string              // optional human text; not part of fingerprint
  entryId?: string
  overrideId?: string
  details?: Record<string, unknown>
  failClosed: boolean
}
```

Extensions must use prefixed codes (e.g. `CORE07_CUSTOM_*`) and must not overload meanings of the frozen set.

---

## 5. Mapping guidance from Phase 3G

| Phase 3G tendency | CORE-07 |
|-------------------|---------|
| `SEEDING_CANDIDATE_INELIGIBLE` | Prefer `ENTRY_INELIGIBLE` (+ keep alias map in adapter if needed) |
| Empty candidates as candidate-required | `INVALID_REQUEST` or policy-defined empty-ok DRAFT |
| Duplicate manual seeds | `DUPLICATE_SEED_NUMBER` / `OVERRIDE_CONFLICT` |

Phase 1C may maintain a compatibility alias table; public CORE-07 docs prefer the frozen names above.

---

## 6. Fail-closed defaults

| Situation | Default |
|-----------|---------|
| Required port unavailable | `INTERNAL_PORT_FAILURE` — do not assign |
| Required eligibility UNKNOWN | `ELIGIBILITY_REQUIRED` — do not assign |
| Duplicate candidates | Fail request — do not partially seed |
| Override conflicts | Reject overrides; fail request if policy strict |
| Finalized mutation | `RESULT_FINALIZED` — no change |
