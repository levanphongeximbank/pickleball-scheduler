# CORE-14 — Integration Boundaries

**Contract family:** `core14-integration-boundaries-v1`
**Phase:** 1B / 1B-S — Contract Freeze
**Status:** Frozen
**Date:** 2026-07-22

---

## 1. Hard import rule

CORE-14 **must not** import unfinished internal code from:

- CORE-10 Global Optimizer
- CORE-11 Schedule Engine
- CORE-12 Court Assignment
- CORE-13 Referee Assignment

Integration is by **published contracts / projectors / ports**, not by reaching into sibling source trees.

CORE-14 **must not** import Venue & Court internals; use [11_AVAILABILITY_PORT.md](./11_AVAILABILITY_PORT.md).

---

## 2. CORE-10 — Global Optimizer

| Direction | Contract |
|-----------|----------|
| Consumes | HARD findings as **constraints** |
| Consumes | SOFT findings as **penalties** |
| May consume | Recommendations as **candidate moves** |
| Owns | Global plan selection |
| Must not | Redefine CORE-14 conflict semantics |

Projector: map `DetectionResult.findings` + `recommendations` into optimizer constraint/penalty/move DTOs without changing codes or severities.

---

## 3. CORE-11 — Schedule Engine

| Direction | Contract |
|-----------|----------|
| Supplies | Time occupancies (`source=SCHEDULE`) |
| Consumes | Overlap / rest findings |
| Consumes | `MOVE_ASSIGNMENT_TIME`, `INSERT_REST_GAP` recommendations |

CORE-11 remains owner of schedule generation. CORE-14 does not write schedule rows.

---

## 4. CORE-12 — Court Assignment

| Direction | Contract |
|-----------|----------|
| Supplies | Court occupancies (`source=COURT_ASSIGNMENT`) |
| Consumes | Court / capacity / availability findings |
| Consumes | `REASSIGN_COURT` (and related time moves if jointly evaluated) |

---

## 5. CORE-13 — Referee Assignment

| Direction | Contract |
|-----------|----------|
| Supplies | Referee occupancies (`source=REFEREE_ASSIGNMENT`) |
| Consumes | Referee overlap / rest / availability findings |
| Consumes | `REASSIGN_REFEREE` recommendations |

---

## 6. Venue & Court

| Direction | Contract |
|-----------|----------|
| Provides | Canonical availability, blackouts, capacity via Availability Port |
| Does not | Become a CORE-14 dependency package import |

---

## 7. CORE-09 — Match Generator

CORE-09 supplies logical matches upstream of scheduling. CORE-14 does not consume MatchPlan as a native type in v1; adapters may project match-bound occupancies using `matchId` fields.

External diagnostics such as `INVALID_BYE_ASSIGNMENT` remain outside CORE-14 ownership ([06_DIAGNOSTIC_CATALOG.md](./06_DIAGNOSTIC_CATALOG.md)).

---

## 8. Production wiring gate

Any Production path that calls CORE-14 requires separate Owner authorization covering:

1. Feature flag / kill switch
2. Integrator export boundary
3. Persistence (if any)
4. UI surfaces
5. Non-regression of CORE-10/11/12/13

Phase 1B and default Phase 1C remain dormant capability-local.
