# CORE-07 — Competition Seeding

**Module:** Competition Engine — Competition Seeding
**Branch:** `feature/competition-core-07-seeding`
**Phase 1A commit (accepted):** `0307d812bc0674a59a388b30829e5190971a01fe`
**Phase:** **1B — Architecture and Contract Freeze** (Owner remediation; ready to commit)
**Date:** 2026-07-21
**Status:** Documentation-only (no production implementation)

Owner remediation locked before commit:

1. Comparator zero / algebraic semantics
2. SeedingScope = competition boundary (policy/snapshot are provenance)
3. Override action ≠ status (`REJECT` is not an action)

---

## Purpose

CORE-07 owns **competition seeding only**: deterministic ordering and assignment of seed numbers to eligible candidates (participants, entries, teams/pairs).

CORE-07 does **not** own:

- Ranking or rating calculation
- Registration / eligibility adjudication (consumes CORE-03 / CORE-01 via ports)
- Participant / roster / lineup / division lifecycles
- Draw / grouping / snake / pot / bracket / matchup generation
- Schedule / court assignment / scoring / standings
- Demo / tenant / SQL “seed data” scripts

---

## Terminology (mandatory)

| Term | Meaning | Owner |
|------|---------|-------|
| **Competition seeding** | Assign seed numbers / ranks to entries | **CORE-07** |
| **Deterministic random seed** | Seeded PRNG input for reproducible ties or open shuffle | Utility / Format / Draw — not competition seeding |
| **Draw / grouping generation** | Place seeded (or shuffled) entities into groups/brackets | Draw / Format (downstream) |

---

## Phase status

| Phase | Status | Notes |
|-------|--------|-------|
| **1A** Existing Seeding Audit | **Accepted** | Commit `0307d81` |
| **1B** Architecture & Contract Freeze | **Accepted with remediation; committing** | Docs `07`–`16` |
| **1C** Domain foundation implementation | **Not started** | Plan: `15` / `16` — no source yet |

---

## Document index

### Phase 1A (accepted)

| File | Content |
|------|---------|
| [01_PHASE_1A_SEEDING_AUDIT.md](./01_PHASE_1A_SEEDING_AUDIT.md) | Executive audit + safety baseline + verdict |
| [02_EXISTING_SEEDING_INVENTORY.md](./02_EXISTING_SEEDING_INVENTORY.md) | Full inventory of seeding surfaces |
| [03_DETERMINISM_ASSESSMENT.md](./03_DETERMINISM_ASSESSMENT.md) | Determinism, RNG, unstable ordering |
| [04_RULE_ENGINE_DEPENDENCY_AUDIT.md](./04_RULE_ENGINE_DEPENDENCY_AUDIT.md) | CORE-01 / eligibility coupling |
| [05_ARCHITECTURAL_GAPS_AND_RISKS.md](./05_ARCHITECTURAL_GAPS_AND_RISKS.md) | Duplication, drift, migration risks |
| [06_PHASE_1B_RECOMMENDATION.md](./06_PHASE_1B_RECOMMENDATION.md) | Scope freeze recommendation (handoff) |

### Phase 1B (architecture freeze)

| File | Content |
|------|---------|
| [07_PHASE_1B_ARCHITECTURE_FREEZE.md](./07_PHASE_1B_ARCHITECTURE_FREEZE.md) | Architecture freeze + safety baseline + invariants |
| [08_CANONICAL_DOMAIN_MODEL.md](./08_CANONICAL_DOMAIN_MODEL.md) | SeedingScope, candidates, policy, snapshot, result |
| [09_PUBLIC_CONTRACTS.md](./09_PUBLIC_CONTRACTS.md) | Public request/result/assignment contracts |
| [10_DETERMINISTIC_ORDERING_CONTRACT.md](./10_DETERMINISTIC_ORDERING_CONTRACT.md) | Total-order algorithm `core07-compare-v1` |
| [11_RULE_ENGINE_AND_ELIGIBILITY_PORTS.md](./11_RULE_ENGINE_AND_ELIGIBILITY_PORTS.md) | EligibilityDecisionPort + RuleEvaluationPort |
| [12_OVERRIDE_FINALIZATION_AND_AUDIT.md](./12_OVERRIDE_FINALIZATION_AND_AUDIT.md) | Overrides, finalization states, audit |
| [13_ERROR_AND_REASON_CODE_MODEL.md](./13_ERROR_AND_REASON_CODE_MODEL.md) | Error/reason categories and codes |
| [14_LEGACY_MIGRATION_BOUNDARY.md](./14_LEGACY_MIGRATION_BOUNDARY.md) | Phase 3G / CC-04B / legacy SSOT disposition |
| [15_PHASE_1C_IMPLEMENTATION_PLAN.md](./15_PHASE_1C_IMPLEMENTATION_PLAN.md) | Increments and source/test locations |
| [16_PHASE_1C_TEST_MATRIX.md](./16_PHASE_1C_TEST_MATRIX.md) | Planned Phase 1C tests |

---

## Frozen ownership (summary)

| Concern | Owner |
|---------|--------|
| Competition seed assignment | **CORE-07** → adapt Phase 3G `seeding/**` |
| CC-04B composite score pipeline | Read-only reference; not implicit CORE-07 |
| Eligibility / Rule Engine | CORE-03 / CORE-01 via ports |
| Draw / snake / pot / bracket | Downstream |
| Legacy TE / official / team engines | Production SSOT until Owner-gated cutover |

---

## Phase 1B verdict (pending Owner)

See `07_PHASE_1B_ARCHITECTURE_FREEZE.md` return report in session handoff.

**Implementation:** none in Phase 1B.
**Next:** Owner review → Phase 1C only after acceptance.
