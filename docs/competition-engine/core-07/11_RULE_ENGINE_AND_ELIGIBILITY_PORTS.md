# CORE-07 — Rule Engine and Eligibility Ports

**Phase:** 1B Architecture Freeze
**Status:** Contract design only — no production implementation

---

## 1. Purpose

Define explicit ports so CORE-07 consumes eligibility and optional Rule Engine evaluation **without** reimplementing rules, owning registration lifecycle, or creating circular dependencies.

---

## 2. Preferred dependency model (default)

```text
CORE-01 (Rule Engine)          CORE-03 (Registration Eligibility)
        │                                  │
        │  facade / adapter                │  decisions / evidence
        └──────────────┬───────────────────┘
                       ▼
                    CORE-07
                       │
                       ▼
               Future Draw Core
```

| Dependency | Default stance |
|------------|----------------|
| **EligibilityDecisionPort** | **Required** when policy `eligibilityRequirements.requireDecision === true` (recommended default: **true** for production-bound paths) |
| **RuleEvaluationPort** | **Optional** — invoke when policy or integrator requests hard `SEEDING` operation rules; fail closed if required and unavailable |
| Ranking/rating calculation | **Forbidden** inside CORE-07 |
| Deep `constraints/**` imports | **Forbidden** — facade only |

**Avoid circular dependency:** CORE-01 and CORE-03 must not import CORE-07. Draw may import CORE-07 results later; CORE-07 must not import Draw.

---

## 3. EligibilityDecisionPort

### 3.1 Responsibilities

1. Accept an existing CORE-03 eligibility decision (or decision set) for the seeding scope.
2. Validate decision **scope** and **version** match the `SeedingRequest` / `SeedingScope`.
3. Expose per-entry `ELIGIBLE` / `INELIGIBLE` / `UNKNOWN` and reason codes.
4. Fail closed when decisions are missing and policy requires them.

### 3.2 Logical interface

```text
EligibilityDecisionPort {
  contractVersion: "core07-eligibility-decision-port-v1"

  resolveDecisions(input: {
    seedingScope: SeedingScope
    entryIds: string[]
    embeddedDecisions?: EligibilityDecision[]
    effectiveAt: string | number
  }) → {
    ok: boolean
    decisionsByEntryId: Map<string, EligibilityDecision>
    reasonCodes: string[]
    evidenceRefs?: string[]
  }
}
```

```text
EligibilityDecision {
  entryId: string
  scopeRef: { competitionId, competitionVersionId, divisionId, categoryId?, stageId? }
  decisionVersion: string
  status: "ELIGIBLE" | "INELIGIBLE" | "UNKNOWN"
  reasonCodes: string[]
  evidenceRef?: string
  decidedAt: string | number   // externally supplied provenance
}
```

### 3.3 CORE-07 behaviour

- Does **not** adjudicate gender/age/payment/rating-gate rules.
- Maps `INELIGIBLE` → excluded (cannot assign).
- Maps `UNKNOWN` → fail (`ELIGIBILITY_REQUIRED`) when required; else exclude or warn per policy (default fail closed when required).
- Structural Phase 3G `eligible !== false` noop is **insufficient** for production cutover; Phase 1C must introduce the port even if default test double embeds decisions.

---

## 4. RuleEvaluationPort

### 4.1 Responsibilities

1. Invoke CORE-01 through an **adapter/facade** (same pattern as CORE-03 Phase 1E).
2. Evaluate seeding-specific configurable rules under `RULE_OPERATION.SEEDING` (and related hard checks as CORE-01 defines).
3. Return rule-set id and version for provenance.
4. Fail closed when required rules cannot be evaluated (`INTERNAL_PORT_FAILURE` or dedicated reason).

### 4.2 Logical interface

```text
RuleEvaluationPort {
  contractVersion: "core07-rule-evaluation-port-v1"

  evaluateSeedingRules(input: {
    seedingScope: SeedingScope
    candidates: SeedingCandidate[]
    operation: "SEEDING"
    effectiveAt: string | number
    context?: Record<string, unknown>
  }) → {
    ok: boolean
    ruleSetId: string
    ruleSetVersion: string
    resultsByEntryId: Map<string, { hardPass: boolean, softWarnings: string[], reasonCodes: string[] }>
    traceRef?: string
  }
}
```

### 4.3 What RuleEvaluationPort is not

- Not a ranking/ordering engine
- Not a substitute for EligibilityDecisionPort
- Not permission for CORE-07 to deep-import constraint internals

---

## 5. Composition rules

1. **Eligibility first** (admission), then optional **RuleEvaluationPort** hard checks, then ordering/assignment.
2. Hard rule failure → exclude or fail closed per policy; never assign.
3. Soft warnings → `SeedingResult.warnings` only.
4. Port failures (transport/adapter) → `INTERNAL_PORT_FAILURE`; do not invent eligibility.
5. Integrator supplies facades; CORE-07 depends on port types only.

---

## 6. Default recommended wiring (non-production until Owner gate)

| Environment | EligibilityDecisionPort | RuleEvaluationPort |
|-------------|-------------------------|--------------------|
| Unit tests | In-memory embedded decisions | Noop or stub returning ok |
| Capability-local Phase 1C | Embedded decisions in request | Optional stub |
| Shadow / staging later | CORE-03 adapter | CORE-01 facade when tournament defines SEEDING rules |
| Production cutover (later Owner) | Required CORE-03 | Per tournament policy |

---

## 7. Import / package constraints

CORE-07 must **not** directly import:

- UI / React / MUI
- Supabase clients
- Browser storage / ClubContext
- Tournament-format modules for rule logic
- `src/features/competition-core/constraints/**` (except via integrator-owned facade module living outside seeding core, injected at composition root)

---

## 8. Alignment with Phase 1A audit

Phase 1A found **zero** direct Rule Engine coupling in `seeding/**` and `seed/**`. Phase 1B freezes ports as the remediation path before any production wire — consistent with `04_RULE_ENGINE_DEPENDENCY_AUDIT.md` and approved conditions C4–C5.
