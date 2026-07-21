# CORE-07 — Competition Seeding

**Module:** Competition Engine — Competition Seeding
**Phase:** 1A — Existing Seeding Audit Re-run
**Branch:** `feature/competition-core-07-seeding`
**Baseline HEAD:** `fb9f482434639621d465cbc35b80e085fb82f383`
**Date:** 2026-07-21
**Status:** Documentation-only (no production implementation)

---

## Purpose

CORE-07 owns **competition seeding only**: deterministic ordering and assignment of seed numbers to eligible candidates (participants, entries, teams).

CORE-07 does **not** own:

- Draw / grouping / snake / pot placement
- Bracket / matchup generation
- Schedule / court assignment
- Rating or ranking recalculation
- Eligibility adjudication (CORE-01 / CORE-03)
- Demo / tenant / SQL “seed data” scripts

---

## Terminology (mandatory)

| Term | Meaning | Owner |
|------|---------|-------|
| **Competition seeding** | Assign seed numbers / ranks to entries | **CORE-07** |
| **Deterministic random seed** | Seeded PRNG input for reproducible ties or open shuffle | Utility / Format / CORE-06 pattern; not competition seeding |
| **Draw / grouping generation** | Place seeded (or shuffled) entities into groups/brackets | Draw / Format (Phase 3H / downstream) |

---

## Document index

| File | Content |
|------|---------|
| [01_PHASE_1A_SEEDING_AUDIT.md](./01_PHASE_1A_SEEDING_AUDIT.md) | Executive audit + safety baseline + verdict |
| [02_EXISTING_SEEDING_INVENTORY.md](./02_EXISTING_SEEDING_INVENTORY.md) | Full inventory of seeding surfaces |
| [03_DETERMINISM_ASSESSMENT.md](./03_DETERMINISM_ASSESSMENT.md) | Determinism, RNG, unstable ordering |
| [04_RULE_ENGINE_DEPENDENCY_AUDIT.md](./04_RULE_ENGINE_DEPENDENCY_AUDIT.md) | CORE-01 / eligibility coupling |
| [05_ARCHITECTURAL_GAPS_AND_RISKS.md](./05_ARCHITECTURAL_GAPS_AND_RISKS.md) | Duplication, drift, migration risks |
| [06_PHASE_1B_RECOMMENDATION.md](./06_PHASE_1B_RECOMMENDATION.md) | Scope freeze recommendation for Phase 1B |

---

## Phase 1A verdict

**READY_WITH_CONDITIONS**

See `01_PHASE_1A_SEEDING_AUDIT.md` for conditions and `06_PHASE_1B_RECOMMENDATION.md` for the proposed Phase 1B freeze.
