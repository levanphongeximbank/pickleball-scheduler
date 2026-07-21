# CORE-07 — Public Contracts

**Phase:** 1B Architecture Freeze
**Status:** Contract design only — no production implementation

---

## 1. Purpose

Freeze the public shapes of CORE-07 inputs and outputs. Integrators and Phase 1C code must treat these as the canonical contracts. Phase 3G request/result shapes must be adapted to match; they are not automatically authoritative where they diverge.

---

## 2. Contract versioning

| Contract family | Initial version id |
|-----------------|--------------------|
| Public seeding API | `core07-seeding-contracts-v1` |
| Deterministic comparison | `core07-compare-v1` (see doc 10) |
| Eligibility port | `core07-eligibility-decision-port-v1` |
| Rule evaluation port | `core07-rule-evaluation-port-v1` |

Breaking changes require a new version id and Owner approval. Soft fields may be added as optional without bumping if ignored by older consumers.

---

## 3. SeedingRequest (immutable)

Minimum canonical request:

```text
SeedingRequest {
  requestId: string                          // mandatory, non-empty
  seedingScope: SeedingScope                 // mandatory
  candidates: SeedingCandidateInput[]        // mandatory (may be empty → fail or empty result per policy)
  eligibility: EligibilityPayload            // decisions embedded OR port reference
  policy: SeedingPolicy                      // mandatory when POLICY_REQUIRED
  rankingRatingSnapshot: RankingRatingSnapshot | null
  manualOverrides: ManualSeedOverride[]      // default []
  deterministicContext: DeterministicContext // mandatory effectiveAt + compare contract version
  actorContext: ActorContext | null
  effectiveAt: string | number               // explicit; must equal or be consistent with deterministicContext.effectiveAt
}
```

### 3.1 Rules

- Request objects are treated as immutable after acceptance (normalize into internal frozen copies).
- CORE-07 **must not** read current time internally.
- CORE-07 **must not** load live ranking/rating; only the provided snapshot (or explicit null when policy allows).
- `eligibility` either embeds CORE-03 decisions scoped to this request or supplies a port handle + decision ids — never silent “eligible by default” when policy requires eligibility.
- Format-specific draw parameters are **out of contract** (caller metadata only).

### 3.2 EligibilityPayload

```text
EligibilityPayload {
  mode: "EMBEDDED_DECISIONS" | "PORT_REFERENCE"
  decisions?: EligibilityDecision[]   // when EMBEDDED
  portRef?: string                    // opaque integrator handle when PORT_REFERENCE
  required: boolean                   // if true, missing/UNKNOWN → ELIGIBILITY_REQUIRED / fail closed
}
```

---

## 4. SeedingScope (public)

```text
SeedingScope {
  competitionId: string                 // mandatory
  competitionVersionId: string | null   // mandatory when competitions are versioned
  divisionId: string | null             // required unless category-only pool authorized
  categoryId: string | null             // required when category is a distinct pool
  stageId: string | null                // optional
  entryType: EntryType                  // mandatory
}
```

`EntryType`: `PARTICIPANT` | `ENTRY` | `PAIR` | `TEAM`

**Not on scope:** `policyId`, `policyVersion`, `snapshotId`, `resultVersion`, `requestId`, fingerprint — these are request/result/policy/snapshot provenance.

Invalid or incomplete competition boundary → `INVALID_SCOPE`.

Canonical scope key: competition boundary only (see domain model §3). Same scope + new policy/snapshot ⇒ new `SeedingResult` version (supersede), not a new scope.

---

## 5. SeedingCandidateInput → SeedingCandidate

Public input may be looser; after normalization the domain `SeedingCandidate` (doc 08) is mandatory.

Normalization failures → `INVALID_CANDIDATE` or `MISSING_STABLE_IDENTIFIER`.

---

## 6. SeedingPolicy (public)

Public policy must include at least:

- `policyId`, `policyVersion`
- `primaryOrderingSource`, `sortDirection`
- `missingValueBehaviour`
- `tieBreakSequence`
- `maximumSeededEntries` (null = no cap beyond eligible set)
- `seedNumberStart`
- `manualOverrideMode`
- `withdrawalDisqualificationHandling`
- `eligibilityRequirements`
- `snapshotRequirements`
- `finalizationRequirements`

Unknown primary source or invalid tie-break field → `INVALID_TIE_BREAK` / `POLICY_REQUIRED`.

`policyId` / `policyVersion` are **not** part of `SeedingScope`. If the request carries duplicate/conflicting policy version declarations (e.g. mismatched embedded fields) → `POLICY_VERSION_MISMATCH`. A deliberate policy version change under the same scope produces a **new result version**, not a new scope.

---

## 7. RankingRatingSnapshot (public)

As in domain model. When `snapshotRequirements.requireSnapshot === true` and snapshot is null → `SNAPSHOT_REQUIRED`.
When completeness insufficient → `SNAPSHOT_INCOMPLETE`.

---

## 8. ManualSeedOverride (public)

```text
ManualSeedOverride {
  overrideId: string
  entryId: string
  action: "ASSIGN" | "PROTECT" | "CLEAR"     // REJECT is not an action
  requestedSeedNumber: number | null
  actor: ...
  reason: string
  createdAt: string | number                 // externally supplied
  authorizationDecision: "ALLOWED" | "DENIED" | "NOT_EVALUATED"
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "SUPERSEDED" | "CANCELLED"
  rejectionReasonCodes: string[]             // when REJECTED
  supersededOverrideId: string | null
  auditMetadata?: Record<string, unknown>
}
```

Conflicts surface as `status: REJECTED` (and/or hard request errors per policy). Never silently drop or rewrite competing overrides. Rejected records retain action, actor, requested seed, reason codes, and scope/policy provenance (doc 12).

---

## 9. SeedAssignment (public)

```text
SeedAssignment {
  entryId: string
  seedNumber: number                    // positive integer
  assignmentSource: AssignmentSource
  scoreValuesUsed: Record<string, unknown>
  orderedTieBreakValues: unknown[]
  policyId: string
  policyVersion: string
  snapshotId: string | null
  overrideId: string | null
  reasonCodes: string[]
  deterministicOrdinal: number
  assignmentFingerprint: string
}
```

---

## 10. SeedingResult (public)

```text
SeedingResult {
  contractVersion: "core07-seeding-contracts-v1"
  requestId: string
  resultId: string
  resultVersion: number | string
  scope: SeedingScope
  orderedAssignments: SeedAssignment[]
  eligibleUnseededEntries: ExclusionRecord[]
  excludedEntries: ExclusionRecord[]
  rejectedOverrides: RejectedOverride[]
  warnings: WarningRecord[]
  policyProvenance: PolicyProvenance
  snapshotProvenance: SnapshotProvenance | null
  deterministicFingerprint: string
  generatedAt: string | number            // caller-supplied; excluded from assignment fingerprint by default
  finalizationState: FinalizationState
}
```

### 10.1 ExclusionRecord

```text
{ entryId, reasonCodes[], eligibilityStatus?, detail? }
```

### 10.2 RejectedOverride

```text
{
  overrideId,
  entryId,
  action,                    // original ASSIGN | PROTECT | CLEAR
  requestedSeedNumber?,
  actor?,
  status: "REJECTED",
  reasonCodes[],
  policyProvenance,
  scope,
  conflictWith?,
  auditMetadata?
}
```

### 10.3 WarningRecord

```text
{ code, message?, entryId?, overrideId?, detail? }
```

---

## 11. Service surface (logical API)

Phase 1C may expose capability-local functions equivalent to:

| Operation | Intent |
|-----------|--------|
| `normalizeSeedingRequest(raw) → SeedingRequest` | Validate + freeze |
| `assignSeeds(request) → SeedingResult` | Canonical assignment (DRAFT) |
| `validateOverrides(request) → RejectedOverride[]` | Conflict scan |
| `fingerprintResult(resultWithoutMeta) → string` | Deterministic fingerprint |
| `finalizeSeedingResult(result, actor, at) → SeedingResult` | DRAFT → FINALIZED |
| `supersedeSeedingResult(prior, newRequest, …) → SeedingResult` | New version; prior → SUPERSEDED |

These are **design names**. Phase 1B does not create source files. Phase 3G `SeedingResolver` / `assignSeeds` must be adapted to these contracts in Phase 1C+.

**Not authorized:** root `competition-core/index.js` export, feature-flag ON, CI manifest merge.

---

## 12. Import boundaries

Allowed inside CORE-07 domain/services:

- Local domain, policies, ports, errors
- Injected port implementations supplied by integrator (facades)

Forbidden:

- Direct UI / React / MUI imports
- Direct Supabase / browser storage
- Direct tournament-format engines (`tournament-engine`, `team-tournament` production engines)
- Deep imports of `constraints/**` (use `RuleEvaluationPort` facade only)
- Direct imports of CC-04B `seed/**` scoring into assignment path

---

## 13. Adapter contracts (design only)

| Adapter | Direction | Role |
|---------|-----------|------|
| Legacy TE → CORE-07 | Inbound | Map `generateSeed` inputs to candidates + snapshot + policy |
| Official entries → CORE-07 | Inbound | Map entry rating sums into snapshot values |
| Team group seed → CORE-07 | Inbound | Map team order metrics; strip snake helpers |
| CORE-07 → Draw | Outbound | Emit `SeedAssignment[]` only; no group placement |
| CORE-03 → EligibilityDecisionPort | Inbound | Eligibility decisions |
| CORE-01 → RuleEvaluationPort | Inbound | Optional `SEEDING` operation evaluation |

Legacy adapters are **not** implemented in Phase 1B.
