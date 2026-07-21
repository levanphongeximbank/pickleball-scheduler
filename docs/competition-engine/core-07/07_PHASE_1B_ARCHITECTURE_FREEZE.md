# CORE-07 Phase 1B — Architecture and Contract Freeze

**Phase:** 1B — Architecture and Contract Freeze (Owner remediation accepted)
**Branch:** `feature/competition-core-07-seeding`
**Phase 1A commit (accepted):** `0307d812bc0674a59a388b30829e5190971a01fe`
**Date:** 2026-07-21
**Status:** Documentation-only (no production implementation)

### Owner remediation (pre-commit)

1. Comparator may return `0` only for the same canonical identity; distinct candidates non-zero after final ID; duplicates fail before sort.
2. `SeedingScope` identity excludes `policyId` / `policyVersion` (provenance → new result version, not new scope).
3. Override actions = `ASSIGN` \| `PROTECT` \| `CLEAR`; rejection is a **status**, not an action.

---

## 1. Safety baseline (verified before documentation)

| # | Check | Result |
|---|-------|--------|
| 1 | Working directory | `C:\Users\Le Phong\PICK_VN-Workstreams\competition-engine\competition-core-07-seeding` |
| 2 | Branch | `feature/competition-core-07-seeding` |
| 3 | HEAD SHA | `0307d812bc0674a59a388b30829e5190971a01fe` |
| 4 | `origin/main` after `git fetch origin` | `fb9f482434639621d465cbc35b80e085fb82f383` |
| 5 | Ahead / behind vs `origin/main` | **ahead 1 / behind 0** |
| 6 | Working-tree status | Clean at Phase 1B start |
| 7 | Phase 1A commit present | **Yes** (HEAD == accepted SHA) |
| 8 | Unrelated local changes | **None** |

**Safety gate:** Proceed. No `BLOCKED_WRONG_WORKSPACE`, `BLOCKED_DIRTY_BASELINE`, or `BLOCKED_MISSING_PHASE_1A`.

---

## 2. Phase objective

Freeze the canonical architecture, public contracts, and module boundaries for CORE-07 Seeding **before implementation begins**.

Phase 1B produces documentation only under `docs/competition-engine/core-07/`.

**Forbidden in Phase 1B:**

- Production source implementation
- Tests
- SQL / RPC changes
- Commits, push, Pull Request, deployment
- Merge / rebase / reset / stash / cherry-pick
- Root export or feature activation

---

## 3. Frozen CORE-07 responsibility

CORE-07 owns **competition seed-number assignment only**.

It transforms:

1. Normalized eligible entries (candidates)
2. Versioned seeding policy inputs
3. Provenance-safe ranking/rating snapshots
4. Explicit manual overrides
5. Explicit deterministic context (caller-supplied)

into:

- Deterministic, explainable, auditable **seed assignments**
- A versioned **SeedingResult** with fingerprint and finalization state

### 3.1 CORE-07 must not own

| Concern | Owner |
|---------|--------|
| Ranking calculation | Upstream ranking / standings |
| Rating calculation | Upstream rating modules |
| Registration lifecycle | CORE-03 |
| Participant identity | CORE-02 |
| Team roster lifecycle | CORE-05 |
| Lineup lifecycle | CORE-06 |
| Division / category lifecycle | CORE-04 |
| Draw generation | Downstream Draw / Format |
| Group allocation | Downstream Draw / Format |
| Snake placement | Downstream Draw / Format |
| Bracket placement | Downstream Draw / Format |
| Matchup generation | Downstream Draw / Format |
| Scheduling / court assignment | Scheduling / ops |
| Scoring / standings | Scoring / standings modules |
| Rule Engine rule resolution | CORE-01 |
| Eligibility adjudication | CORE-03 (+ CORE-01 rules) |

### 3.2 Terminology freeze

| Term | Meaning | Owner |
|------|---------|-------|
| **Competition seeding** | Assign seed numbers to eligible candidates | **CORE-07** |
| **Deterministic random seed** | Seeded PRNG input for reproducible shuffle/ties elsewhere | Utility / Draw / Format — **not** competition seeding |
| **Draw / grouping** | Place seeded entities into groups/brackets | Downstream |

---

## 4. Approved Phase 1A conditions (frozen)

Unless a blocking contradiction is proven, the following remain frozen:

| # | Condition |
|---|-----------|
| 1 | Phase 3G `seeding/**` is the preferred runtime migration target |
| 2 | Phase 3G code must not be copied blindly; it must conform to canonical CORE-07 contracts |
| 3 | CC-04B `seed/**` remains read-only during Phase 1B |
| 4 | CC-04B composite scoring must not become an implicit CORE-07 responsibility |
| 5 | Eligibility is consumed through explicit CORE-03 / CORE-01 ports |
| 6 | CORE-07 must not reimplement Rule Engine rules |
| 7 | Draw, grouping, snake, pot placement and bracket logic remain downstream |
| 8 | `Math.random()`, wall-clock values and unstable ordering are prohibited from canonical seed assignment |
| 9 | No production wiring, root export or feature activation in Phase 1B |

**Phase 1A findings:** No factual corrections applied in Phase 1B.

---

## 5. Canonical architecture

```text
                    ┌─────────────────────────┐
                    │  Caller / Integrator    │
                    │  (explicit timestamps,  │
                    │   snapshots, overrides) │
                    └───────────┬─────────────┘
                                │ SeedingRequest
                                ▼
┌──────────────┐     ┌─────────────────────────┐     ┌─────────────────┐
│ CORE-03      │────►│        CORE-07          │────►│ Future Draw     │
│ Eligibility  │port │  normalize → validate   │     │ Core (consume   │
│ decisions    │     │  → order → assign       │     │  SeedAssignment)│
└──────────────┘     │  → fingerprint → result │     └─────────────────┘
┌──────────────┐     └───────────┬─────────────┘
│ CORE-01      │port             │
│ Rule Engine  │─────────────────┘
│ (SEEDING op) │   fail-closed when required
└──────────────┘

UPSTREAM (consume only): RankingRatingSnapshot, identity refs
OUT: UI, Supabase, browser state, tournament-format engines
```

**Dependency direction (mandatory):**

```text
CORE-01 / CORE-03
        ↓
     CORE-07
        ↓
 Future Draw Core
```

No circular dependency. CORE-07 must not deep-import `constraints/**`, UI, Supabase, or format engines.

---

## 6. Module boundary (proposed Phase 1C layout — design only)

```text
src/features/competition-core/seeding/
  domain/          # value objects, normalization, invariants
  policies/        # policy normalization (not Rule Engine)
  ports/           # EligibilityDecisionPort, RuleEvaluationPort, …
  services/        # assign, compare, fingerprint, override validate
  errors/          # reason/error codes
  index.js         # capability-local exports only
```

Phase 3G already occupies this tree. Phase 1C **adapts** it to frozen contracts; it does not invent a second production path and does not copy CC-04B scoring into CORE-07.

**Not created in Phase 1B.**

---

## 7. Pipeline (logical — not orchestrated workflow)

1. Accept immutable `SeedingRequest` (caller supplies `effectiveAt` / `generatedAt`).
2. Validate scope, policy, snapshot requirements, candidate uniqueness.
3. Normalize candidates to `SeedingCandidate`.
4. Consume eligibility via `EligibilityDecisionPort` (fail closed when required).
5. Optionally evaluate seeding rules via `RuleEvaluationPort` (fail closed when required).
6. Apply manual override validation (no silent conflict resolution).
7. Deterministic total-order remaining auto-seed candidates.
8. Assign unique positive seed numbers within `SeedingScope`.
9. Build `SeedingResult` with provenance + fingerprint (excludes wall-clock unless explicitly fingerprinted separately).
10. Optional finalization transition (DRAFT → FINALIZED) — state semantics only; no workflow engine.

---

## 8. Document index (Phase 1B)

| File | Purpose |
|------|---------|
| [08_CANONICAL_DOMAIN_MODEL.md](./08_CANONICAL_DOMAIN_MODEL.md) | Domain concepts and invariants |
| [09_PUBLIC_CONTRACTS.md](./09_PUBLIC_CONTRACTS.md) | Public request/result/assignment contracts |
| [10_DETERMINISTIC_ORDERING_CONTRACT.md](./10_DETERMINISTIC_ORDERING_CONTRACT.md) | Total-order algorithm |
| [11_RULE_ENGINE_AND_ELIGIBILITY_PORTS.md](./11_RULE_ENGINE_AND_ELIGIBILITY_PORTS.md) | Port model |
| [12_OVERRIDE_FINALIZATION_AND_AUDIT.md](./12_OVERRIDE_FINALIZATION_AND_AUDIT.md) | Overrides + finalization |
| [13_ERROR_AND_REASON_CODE_MODEL.md](./13_ERROR_AND_REASON_CODE_MODEL.md) | Errors / reasons |
| [14_LEGACY_MIGRATION_BOUNDARY.md](./14_LEGACY_MIGRATION_BOUNDARY.md) | 3G / CC-04B / legacy SSOT |
| [15_PHASE_1C_IMPLEMENTATION_PLAN.md](./15_PHASE_1C_IMPLEMENTATION_PLAN.md) | Increments (no code yet) |
| [16_PHASE_1C_TEST_MATRIX.md](./16_PHASE_1C_TEST_MATRIX.md) | Planned tests (no tests yet) |

---

## 9. Required invariants (frozen)

1. Seed numbers are positive integers.
2. Seed numbers are unique within one `SeedingScope` (competition boundary — not per policy version).
3. One entry has at most one assignment per result.
4. Ineligible entries cannot be assigned.
5. Duplicate candidates fail closed.
6. Manual overrides cannot silently conflict.
7. Missing ranking/rating follows explicit policy.
8. Tie resolution is a total deterministic order over distinct validated identities; `compare(A,A)===0`; distinct candidates never compare as 0 after final `stableCanonicalId`.
9. Final tie-break uses a stable canonical identifier.
10. Policy and snapshot provenance are mandatory on results (when policy/snapshot are required by the request); they are **not** part of scope identity.
11. A finalized result is immutable.
12. Superseding produces a new result version under the **same** scope (including policy/snapshot changes).
13. Same normalized deterministic inputs produce the same assignments and fingerprint.
14. Output does not depend on input array order when all required tie-break fields are supplied.

---

## 10. Phase 1B verdict (for Owner)

Architecture and contracts are frozen pending Owner review of this document set.

**Implementation status:** Documentation only — **READY_FOR_PHASE_1C** if Owner accepts contracts without blocking changes; otherwise **READY_WITH_CONDITIONS** or **BLOCKED** per Owner decision.
