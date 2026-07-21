# CORE-07 — Canonical Domain Model

**Phase:** 1B Architecture Freeze
**Baseline Phase 1A:** `0307d812bc0674a59a388b30829e5190971a01fe`
**Status:** Contract design only — no production implementation

---

## 1. Purpose

Define the canonical CORE-07 domain concepts that all Phase 1C+ implementations must conform to. Phase 3G runtime shapes are a migration target, not an automatic source of truth where they diverge from this model.

---

## 2. Concept map

```text
SeedingScope
    └── SeedingRequest
            ├── SeedingCandidate[]
            ├── SeedingPolicy (versioned)
            ├── RankingRatingSnapshot
            ├── ManualSeedOverride[]
            ├── DeterministicContext
            └── ActorContext? / EligibilityDecisionPort ref

SeedingResult
    ├── SeedAssignment[] (ordered)
    ├── eligibleUnseeded[]
    ├── excluded[]
    ├── rejectedOverrides[]
    ├── warnings[]
    ├── provenance (policy + snapshot)
    ├── fingerprint
    └── finalizationState
```

---

## 3. SeedingScope

Unique **competition boundary** within which seed numbers **must** be unique for the authoritative result.

`SeedingScope` identifies **where** seeding applies. It does **not** include computation or result provenance.

### 3.1 Fields

| Field | Mandatory? | Notes |
|-------|------------|-------|
| `competitionId` | **Yes** | Competition identity |
| `competitionVersionId` | **Yes** when the product versions competition definitions; otherwise may be an explicit sentinel only if validation rules allow | Prefer always present when versioned competitions exist |
| `divisionId` | **Yes** when division is the seed pool; required unless category-only pools are explicitly authorized | At least one of `divisionId` or `categoryId` must identify the pool |
| `categoryId` | **Yes** when category is a distinct seed pool; otherwise null / sentinel when division is the sole pool | Prefer explicit category when product has categories |
| `stageId` | **Optional** | When seeding is stage-scoped (e.g. playoff reseeding); omit or null when whole-division/category |
| `entryType` | **Yes** | Canonical enum: `PARTICIPANT` \| `ENTRY` \| `PAIR` \| `TEAM` (extend only via contract version) |

### 3.2 Not part of scope identity (provenance / computation)

The following are **computation and result provenance**, carried on the request, policy, snapshot, and/or `SeedingResult` — **never** on the canonical scope key:

| Field | Lives on |
|-------|----------|
| `policyId` / `policyVersion` | `SeedingPolicy` + result `policyProvenance` |
| `snapshotId` | `RankingRatingSnapshot` + result `snapshotProvenance` |
| `resultVersion` / `resultId` | `SeedingResult` |
| `requestId` | `SeedingRequest` / result |
| `deterministicFingerprint` | `SeedingResult` |

### 3.3 Rules

- Scope identity is the competition-boundary tuple of applicable fields in §3.1 (including `stageId` when present).
- **Avoid format-specific fields** (`formatKey`, bracket type, draw size) inside `SeedingScope`.
- Changing **policy** or **snapshot** within the same `SeedingScope` creates a **new `SeedingResult` version** that **supersedes** the prior authoritative result. It must **not** silently create a parallel authoritative scope.
- Seed number uniqueness is enforced **within one `SeedingScope`** for the authoritative (typically FINALIZED) result — not globally across competitions, and not by minting a new scope per policy version.
- Downstream Draw consumes **one authoritative finalized result per scope**.

### 3.4 Scope key (canonical)

Logical key (implementation may hash):

```text
competitionId | competitionVersionId? | divisionId? | categoryId? | stageId? | entryType
```

Validation: incomplete boundary (missing `competitionId`, missing `entryType`, or neither division nor category when both absent without authorized sentinel) → `INVALID_SCOPE`.

String comparison for key components uses the frozen string contract in `10_DETERMINISTIC_ORDERING_CONTRACT.md`.

---

## 4. SeedingCandidate

Normalized candidate admitted for seeding consideration.

### 4.1 Fields

| Field | Mandatory? | Notes |
|-------|------------|-------|
| `entryId` | **Yes** | Primary entry identifier within scope |
| `subjectRef` | **Yes** | Participant / team / pair reference (`{ kind, id }`) |
| `entryType` | **Yes** | Must match scope `entryType` |
| `divisionId` | **Yes** | Must match scope (or fail closed) |
| `categoryId` | **Yes** when scope has category | Must match scope |
| `eligibilityStatus` | **Yes** | `ELIGIBLE` \| `INELIGIBLE` \| `UNKNOWN` — UNKNOWN fails when eligibility required |
| `eligibilityReasonCodes` | **Yes** (may be empty array) | Opaque codes from CORE-03 / port |
| `rankingPosition` | Optional | From snapshot; null = missing |
| `rankingScore` | Optional | From snapshot; null = missing |
| `ratingValue` | Optional | From snapshot; null = missing |
| `registrationTimestamp` | Optional | Caller-supplied ISO / epoch ms; never wall-clock read |
| `sourceMetadata` | Optional | Opaque provenance bag (not used as silent tie-break) |
| `stableCanonicalId` | **Yes** | Final total-order tie-break identity |

### 4.2 Mandatory normalization rules

1. Trim and reject empty `entryId` / `stableCanonicalId`.
2. Coerce numeric ranking/rating only when finite; otherwise treat as **missing** (`null`), never `NaN`.
3. Do not invent default rating/ranking values inside CORE-07 (legacy TE defaults are adapter concerns).
4. `stableCanonicalId` must be opaque and stable across re-runs (prefer entry identity key, not display name).
5. Duplicate `entryId` or duplicate `stableCanonicalId` within one request → fail closed (`DUPLICATE_CANDIDATE`).
6. Input array order must not affect assignment when all required ordering fields are present.
7. `eligibilityStatus` may be pre-populated from port results; CORE-07 does not re-judge rules.

---

## 5. SeedingPolicy

Versioned policy controlling configurable seeding behaviour.

### 5.1 Fields

| Field | Purpose |
|-------|---------|
| `policyId` | Identity |
| `policyVersion` | Exact version |
| `primaryOrderingSource` | e.g. `RANKING_POSITION` \| `RATING_VALUE` \| `RANKING_SCORE` \| `REGISTRATION_TIMESTAMP` |
| `sortDirection` | `ASC` \| `DESC` for primary source |
| `missingValueBehaviour` | `SORT_LAST` \| `SORT_FIRST` \| `EXCLUDE` \| `FAIL` |
| `tieBreakSequence` | Ordered list of tie-break field keys (policy-configurable) |
| `maximumSeededEntries` | Cap on assigned seeds; remainder → eligible unseeded |
| `seedNumberStart` | Usually `1`; positive integer |
| `seedBands` | Optional metadata bands for **downstream** placement aids — CORE-07 may attach band labels only if policy requests; CORE-07 does **not** place into groups |
| `manualOverrideMode` | `DISALLOW` \| `ALLOW_PARTIAL` \| `REQUIRE_AUTHORIZED` |
| `withdrawalDisqualificationHandling` | `EXCLUDE` \| `FAIL_IF_PRESENT` (consume status; do not adjudicate) |
| `eligibilityRequirements` | e.g. require port decision; fail on UNKNOWN |
| `snapshotRequirements` | require snapshot; completeness rules |
| `finalizationRequirements` | who may finalize; immutability rules reference |

### 5.2 Three layers (must not be conflated)

| Layer | Examples | Owner |
|-------|----------|-------|
| **Rule Engine rules** | Hard/soft `SEEDING` / eligibility rules, authority ladder | CORE-01 via port |
| **CORE-07 invariants** | Unique positive seeds; total order; no RNG; no silent override conflicts | CORE-07 (non-negotiable) |
| **Policy-configurable behaviour** | Primary order source, missing-value mode, max seeded, override mode | `SeedingPolicy` |

CORE-07 must not encode Rule Engine business rules inside policy objects beyond referencing rule-set IDs for port calls.

---

## 6. RankingRatingSnapshot

Provenance-safe snapshot consumed by CORE-07. CORE-07 **never calculates** ranking or rating.

| Field | Mandatory? | Notes |
|-------|------------|-------|
| `snapshotId` | **Yes** | Unique snapshot identity |
| `sourceSystem` | **Yes** | e.g. rating-v5, standings-engine |
| `sourceVersion` | **Yes** | Producer version |
| `capturedAt` | **Yes** | Caller-supplied |
| `effectiveAt` | **Yes** | Caller-supplied effective time |
| `subjectValues` | **Yes** | Map/list of subject → ranking/rating fields |
| `checksum` / `fingerprint` | **Yes** | Integrity of subjectValues |
| `completenessState` | **Yes** | `COMPLETE` \| `PARTIAL` \| `EMPTY` |
| `missingDataMetadata` | Optional | Which subjects lack values |

Policy may require `COMPLETE` or allow `PARTIAL` with explicit missing-value behaviour.

---

## 7. ManualSeedOverride

Actions and processing status are **separate**. `REJECT` is **not** an action.

### 7.1 Action (requested intent)

| Action | Meaning |
|--------|---------|
| `ASSIGN` | Request to reserve `requestedSeedNumber` for `entryId` |
| `PROTECT` | Request assign with protected semantics |
| `CLEAR` | Request to remove a prior override effect (DRAFT only) |

### 7.2 Status / disposition (processing outcome)

| Status | Meaning |
|--------|---------|
| `PENDING` | Not yet processed |
| `ACCEPTED` | Applied to the working assignment set |
| `REJECTED` | Not applied; retained for audit |
| `SUPERSEDED` | Replaced by a later override; retained for audit |
| `CANCELLED` | Withdrawn before accept; retained for audit |

### 7.3 Fields

| Field | Mandatory? | Notes |
|-------|------------|-------|
| `overrideId` | **Yes** | Unique |
| `entryId` | **Yes** | Target entry |
| `requestedSeedNumber` | **Yes** for `ASSIGN` / `PROTECT` | Positive integer in range; optional/null for `CLEAR` |
| `action` | **Yes** | `ASSIGN` \| `PROTECT` \| `CLEAR` only |
| `actor` | **Yes** when authorization required | Actor identity |
| `reason` | **Yes** | Human / code reason for the request |
| `createdAt` | **Yes** | Externally supplied |
| `authorizationDecision` | **Yes** when mode requires | `ALLOWED` \| `DENIED` \| `NOT_EVALUATED` |
| `status` | **Yes** | `PENDING` \| `ACCEPTED` \| `REJECTED` \| `SUPERSEDED` \| `CANCELLED` |
| `rejectionReasonCodes` | **Yes** when `status === REJECTED` | e.g. `OVERRIDE_UNAUTHORIZED` |
| `supersededOverrideId` | Optional | Prior override this one replaces |
| `policyProvenance` | **Yes** on accepted/rejected records in a result | policyId + policyVersion |
| `scope` | **Yes** on result-linked records | `SeedingScope` boundary |
| `auditMetadata` | Optional | Opaque audit bag |

A **rejected** override retains at minimum: `overrideId`, requested `action`, `actor`, `requestedSeedNumber` when applicable, rejection reason codes, policy and scope provenance, and audit metadata. Rejected overrides **must not** mutate assignments.

Conflict handling is defined in `12_OVERRIDE_FINALIZATION_AND_AUDIT.md`. **No silent conflict resolution.**

---

## 8. SeedAssignment

Immutable assignment record inside a result.

| Field | Mandatory? |
|-------|------------|
| `entryId` | Yes |
| `seedNumber` | Yes (positive integer) |
| `assignmentSource` | Yes (`MANUAL_OVERRIDE` \| `PROTECTED` \| `AUTO_ORDER` \| …) |
| `scoreValuesUsed` | Yes (may be empty object) — ranking/rating values actually used |
| `orderedTieBreakValues` | Yes — values that decided order |
| `policyId` / `policyVersion` | Yes |
| `snapshotId` | Yes when snapshot required |
| `overrideId` | When manual/protected |
| `reasonCodes` | Yes (may be empty) |
| `deterministicOrdinal` | Yes — 0-based position in total order among auto-assigned (or explicit for manual) |
| `assignmentFingerprint` | Yes — hash of assignment inputs |

---

## 9. SeedingResult

| Field | Notes |
|-------|-------|
| `scope` | `SeedingScope` |
| `resultId` / `resultVersion` | Versioned result identity |
| `orderedAssignments` | Seed assignments sorted by `seedNumber` ascending |
| `eligibleUnseededEntries` | Eligible but beyond `maximumSeededEntries` or policy EXCLUDE-from-seed pool |
| `excludedEntries` | Ineligible / withdrawn / DQ / failed validation (with reason codes) |
| `rejectedOverrides` | Overrides that failed conflict/auth checks |
| `warnings` | Non-fatal issues |
| `policyProvenance` | policyId + policyVersion + optional rule-set refs |
| `snapshotProvenance` | snapshotId + checksum + completeness |
| `deterministicFingerprint` | Fingerprint of assignment-relevant inputs/outputs |
| `generatedAt` | **Caller-supplied**; does **not** participate in deterministic assignment fingerprint by default |
| `finalizationState` | `DRAFT` \| `FINALIZED` \| `SUPERSEDED` \| `CANCELLED` |

### 9.1 `generatedAt` vs fingerprint

- `generatedAt` is audit metadata.
- Canonical assignment fingerprint **excludes** `generatedAt` unless an explicit secondary audit fingerprint is defined.
- Re-run equivalence compares assignments + deterministic fingerprint, not wall-clock fields.

---

## 10. SeedingFinalization (state semantics)

| State | Meaning |
|-------|---------|
| `DRAFT` | Mutable under rules; may re-resolve |
| `FINALIZED` | Immutable assignment set for this `resultVersion` |
| `SUPERSEDED` | Replaced by a newer `resultVersion` |
| `CANCELLED` | Abandoned; not authoritative |

Policy or snapshot change under the **same** `SeedingScope` → new `resultVersion` that supersedes the prior authoritative result (see `12_OVERRIDE_FINALIZATION_AND_AUDIT.md`). Does **not** create a second parallel scope.

Details: `12_OVERRIDE_FINALIZATION_AND_AUDIT.md`. No workflow orchestration in CORE-07.

---

## 11. DeterministicContext

Caller-supplied context for reproducibility:

| Field | Notes |
|-------|-------|
| `effectiveAt` | Explicit; never `Date.now()` inside CORE-07 |
| `comparisonContractVersion` | Frozen string/number compare rules version |
| `optionalDeterministicTieSeed` | Only if policy allows deterministic PRNG tie keys — **not** competition seed numbers; prefer stable ID final tie-break as default |

Default CORE-07 stance: **final tie-break = `stableCanonicalId`**. Optional PRNG tie keys are discouraged for competition seeding and belong primarily to Draw when needed.

---

## 12. ActorContext

Optional when authorization applies:

- `actorId`, `roles`, `tenantId` / competition admin claims
- Used for override authorization and finalization permission checks via injected auth decision — CORE-07 does not own identity lifecycle.
