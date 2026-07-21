# CORE-07 — Override, Finalization, and Audit

**Phase:** 1B Architecture Freeze
**Status:** Contract design only — no production implementation

---

## 1. Purpose

Freeze manual override conflict semantics, finalization state machine meaning, and audit requirements. CORE-07 defines **state semantics and validation**, not workflow orchestration, approval queues, or UI.

---

## 2. ManualSeedOverride semantics

### 2.1 Actions (requested intent only)

| Action | Meaning |
|--------|---------|
| `ASSIGN` | Request to reserve `requestedSeedNumber` for `entryId` |
| `PROTECT` | Request assign with protected semantics (harder to clear without authority) |
| `CLEAR` | Request to remove a prior override effect for entry (only if result still DRAFT) |

**`REJECT` is not an action.** Rejection is a **status / disposition** after processing.

### 2.2 Status / disposition

| Status | Meaning |
|--------|---------|
| `PENDING` | Not yet processed |
| `ACCEPTED` | Applied; may mutate the working DRAFT assignment set |
| `REJECTED` | Not applied; retained for audit; **must not** mutate assignments |
| `SUPERSEDED` | Replaced by a later override; remains auditable |
| `CANCELLED` | Withdrawn before accept; remains auditable |

### 2.3 Conflict handling (no silent resolution)

| Conflict | Handling |
|----------|----------|
| **Duplicate seed number** (two overrides same `requestedSeedNumber`) | Conflicting overrides → `status: REJECTED` with `DUPLICATE_SEED_NUMBER` / `OVERRIDE_CONFLICT` — **never** keep one silently |
| **Duplicate override for one entry** (two active ASSIGN/PROTECT) | Later/conflicting → `REJECTED` or prior → `SUPERSEDED` per explicit supersession chain (`supersededOverrideId`) — do not merge silently |
| **Out-of-range seed** (`< seedNumberStart`, non-integer, below 1, or beyond policy max bound if defined) | `REJECTED`; reason `INVALID_REQUEST` / override-specific range code |
| **Ineligible entry** | `REJECTED`; `ENTRY_INELIGIBLE` — cannot assign |
| **Withdrawn / disqualified entry** | `REJECTED` per `withdrawalDisqualificationHandling`; never assign |
| **Override after finalization** (including `CLEAR`) | `REJECTED`; `RESULT_FINALIZED` |
| **Unauthorized actor** | `REJECTED`; `OVERRIDE_UNAUTHORIZED` when `authorizationDecision !== ALLOWED` under `REQUIRE_AUTHORIZED` / protected mode |

### 2.4 Rejected override retention

A rejected override **must** retain:

- `overrideId`
- requested `action` (`ASSIGN` \| `PROTECT` \| `CLEAR`)
- `actor`
- `requestedSeedNumber` when applicable
- rejection reason code(s)
- policy and scope provenance
- audit metadata

All rejected overrides appear in `SeedingResult.rejectedOverrides`. Hard modes may also fail the entire request when policy `manualOverrideMode` demands strictness. Rejected overrides **do not** mutate assignments.

### 2.5 Authorization

- CORE-07 consumes `authorizationDecision` on the override (or an injected auth check result).
- CORE-07 does **not** own RBAC evaluation internals.
- `NOT_EVALUATED` is insufficient when mode requires authorization → override `status: REJECTED` with `OVERRIDE_UNAUTHORIZED`.

### 2.6 Audit metadata on overrides

Minimum audit fields when accepted, rejected, superseded, or cancelled:

- `overrideId`, `entryId`, `action`, `requestedSeedNumber` (when applicable)
- `actor`, `reason`, `createdAt` (external)
- `authorizationDecision`, `status`, `rejectionReasonCodes` when rejected
- Link to `requestId` / `resultId` / `resultVersion`
- `SeedingScope` + policy provenance (`policyId` / `policyVersion`)

---

## 3. Finalization state semantics

### 3.1 States

| State | Mutable assignments? | Authoritative for draw consumption? |
|-------|----------------------|-------------------------------------|
| `DRAFT` | Yes (within CORE-07 rules) | No (unless integrator explicitly allows draft preview) |
| `FINALIZED` | **No** | Yes for this `resultVersion` |
| `SUPERSEDED` | No | No — replaced by newer version |
| `CANCELLED` | No | No |

### 3.2 Who may finalize

Defined by `SeedingPolicy.finalizationRequirements` (e.g. competition director role). CORE-07 checks an injected authorization decision / actorContext claim — it does not implement a workflow engine.

Missing authority → fail closed (do not finalize).

### 3.3 What becomes immutable on FINALIZED

- `orderedAssignments` (entryId ↔ seedNumber ↔ sources)
- `deterministicFingerprint`
- `scope`, policy/snapshot provenance used for that result
- Applied override set that produced the result

Allowed after finalize (metadata only, if integrator stores wrappers outside CORE-07): external publication timestamps — **not** changes to assignments.

### 3.4 Superseding a finalized result

1. Create a **new** `resultId`/`resultVersion` from a new `SeedingRequest` (or explicit supersede operation) under the **same** `SeedingScope`.
2. Prior result transitions `FINALIZED` → `SUPERSEDED` (or remains historically addressable with explicit SUPERSEDED state on prior).
3. Never mutate the prior assignment list in place.
4. Audit must link `supersedesResultId` / `supersededByResultId`.
5. Changing **policy** (`policyId` / `policyVersion`) or **snapshot** under the same competition scope **must** produce a new result version that supersedes the prior authoritative result. It must **not** create a second parallel authoritative `SeedingScope`.
6. Downstream Draw receives **one** authoritative finalized result per scope (the current non-superseded FINALIZED result).

### 3.5 Withdrawal after finalization

- CORE-07 does **not** silently remove a finalized seed.
- Withdrawal after finalize is an **upstream status event**; remediation requires a **new superseding result** (or CANCELLED + new draft) under Owner/integrator process.
- Draw module decides how to handle byes / vacancies; CORE-07 only issues a new seed map when re-invoked.

### 3.6 Idempotency

- `finalize(resultX)` when already `FINALIZED` with same fingerprint → idempotent success (same result).
- `finalize` with mutated assignments → reject (`RESULT_FINALIZED` / conflict).
- Re-assign with identical normalized deterministic inputs → same fingerprint; may create a new DRAFT that matches prior — integrator decides whether to no-op.

### 3.7 Non-goals

- Approval workflows, notifications, multi-step sagas
- Persistence orchestration (persistence port remains OFF by default)
- Automatic draw invalidation callbacks (integrator concern)

---

## 4. Audit requirements (minimum)

Every authoritative result (especially FINALIZED) must be reconstructable from:

1. Request identity + scope
2. Policy id/version
3. Snapshot id + checksum
4. Eligibility decision versions / evidence refs
5. Optional rule-set id/version from RuleEvaluationPort
6. Applied and rejected overrides
7. Deterministic fingerprint
8. Actor + externally supplied timestamps for finalize/supersede

CORE-07 produces audit-ready structures; storage is via future persistence port / integrator.

---

## 5. Alignment with Phase 3G

Phase 3G supports `manualSeed` / `protectedSeed` with duplicate/OOR rejection — retain that fail-closed spirit. Phase 1C must extend with explicit authorization, action≠status separation (`ASSIGN`/`PROTECT`/`CLEAR` vs `ACCEPTED`/`REJECTED`/…), supersession references, finalization states, and rejected-override records per this freeze.
