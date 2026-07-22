# CORE-14 — Ownership Boundary

**Contract family:** `core14-ownership-v1`
**Phase:** 1B / 1B-S — Contract Freeze
**Status:** Frozen for Phase 1C design; **Phase 1C runtime not authorized** in Phase 1B-S
**Date:** 2026-07-22

---

## 1. Official ownership map

| Core | Name | Owns |
|------|------|------|
| CORE-09 | Match Generator | Logical match plan generation |
| CORE-10 | Global Optimizer | Global plan selection under constraints/penalties |
| CORE-11 | Schedule Engine | Schedule / time assignment |
| CORE-12 | Court Assignment | Court assignment |
| CORE-13 | Referee Assignment | Referee assignment |
| CORE-14 | Resource Conflict Resolver | Resource conflict detection, classification, local recommendations, dry-run validation, projections |

---

## 2. CORE-14 owns

1. **Resource conflict detection** over supplied occupancies and availability answers.
2. **Conflict classification** using the frozen finding catalog.
3. **Deterministic local resolution recommendations** as structured deltas (never applied).
4. **Dry-run recommendation validation** against projected occupancies.
5. **Conflict and recommendation projection** for consumers (CORE-10/11/12/13 adapters).

---

## 3. CORE-14 does not own

| Concern | Owner |
|---------|-------|
| Match generation | CORE-09 |
| Schedule generation / time assignment | CORE-11 |
| Court assignment | CORE-12 |
| Referee assignment | CORE-13 |
| Global optimization / plan selection | CORE-10 |
| Player / team / court / venue / location / referee / equipment inventory | Respective domain owners |
| Availability source of truth (windows, blackouts, capacity) | Venue & Court (via neutral port) |
| Persistence / SQL / RPC | Integrator / persistence owners |
| UI / workflow / notifications | Product surfaces |
| Deployment | Ops / Owner release process |

---

## 4. Consumption rules

- CORE-14 **consumes** occupancies supplied by callers (typically CORE-11/12/13 projectors).
- CORE-14 **consumes** availability/capacity/blackout answers only through the frozen Availability Port.
- CORE-14 **must not** import Venue & Court internal modules.
- CORE-14 **must not** import unfinished internal source from CORE-10, CORE-11, CORE-12, or CORE-13.
- Consumers **must not** redefine CORE-14 conflict semantics.

---

## 5. Future module path (Phase 1C+, not created now)

```text
src/features/competition-core/resource-conflict/
```

Capability-local public surface only. Root Integrator export and production wiring remain Owner-gated and out of Phase 1B/1C default scope unless separately authorized.

---

## 6. Anti-patterns

- Detecting conflicts by inventing resource identity from display names or first-record inference
- Treating same `venueId` alone as a conflict
- Applying recommendations inside CORE-14
- Certifying a plan conflict-free when authoritative availability is incomplete
- Emitting both generic and specialized finding codes for one root cause
- Collapsing evaluation failure and plan invalidity into one boolean
