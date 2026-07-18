# 00 — Phase 3.0 Executive Summary

**Phase:** Runtime Migration Architecture and Cutover Plan  
**Status:** ARCHITECTURE READY FOR OWNER REVIEW  
**Date:** 2026-07-18  
**Branch:** `audit/competition-engine-phase-3-runtime-migration-plan`  
**Base SHA:** `5f7ba8d08d013d1ee3d0857a73df36595b66803a` (Phase 2B.4 merge on `origin/main`)

---

## Locked foundation (unchanged)

```text
Phase 2A:  CLOSED — Architecture Boundaries
Phase 2B.1–2B.4: CLOSED — Participant Domain Foundation
Merge: 5f7ba8d
Production: https://pickvn.app

Canonical foundation: COMPLETE
Production runtime:   INACTIVE
Persistence:          NOT IMPLEMENTED
Production SSOT:      NOT YET
Runtime cutover:      NOT PERFORMED
Competition Core flags: OFF
Legacy runtime:       Production executor
```

Phase 3.0 does **not** change these conclusions.

---

## What Phase 3.0 is

Design-only architecture for migrating capabilities:

```text
Legacy runtime
  → Shadow execution
  → Parity verification
  → Limited tenant rollout
  → Controlled cutover
  → Legacy retirement
```

**Not** an implementation phase. No runtime executor, no SQL, no flag enablement, no cutover, no Phase 3A start.

---

## Production reality (audit)

| Stack | Role today |
|-------|------------|
| LEGACY (`src/tournament/engines`, `src/ai`, `pages/*.logic.js`) | Primary for Daily / Internal / Official |
| FORMAT_LOCAL Team Tournament | Primary for roster / lineup / TT standings / publish |
| FORMAT_LOCAL Individual Tournament | Primary for registration / eligibility / match results |
| TOURNAMENT_ENGINE_4 | Parallel UI path at `/tournaments/:id/engine` — **not** setup SSOT |
| COMPETITION_CORE | Contracts, adapters, shadow helpers — **flags OFF**; adapters still call legacy |

**~45–55 real executors**, **~25–35 wrappers**. Multiple duplicate algorithms for standings, draw, schedule, pairing, eligibility.

---

## Recommended Phase 3 order

| Phase | Name | Why first / when |
|-------|------|------------------|
| **3A** | Runtime Control Plane + Shadow Infrastructure | Prerequisite for every later capability |
| **3B** | Participant Resolution Runtime | Identity is critical; contracts complete |
| **3C** | Registration and Entry Runtime | Depends on participant SSOT path |
| **3D** | Team and Roster Runtime | Format-owned behavior; ports + shadow |
| **3E** | Lineup Runtime | Depends on roster + rules bridge |
| **3F** | Seeding Runtime | Before draw |
| **3G** | Draw and Grouping Runtime | High risk; Owner conditioned |
| **3H** | Match Generation and Pairing Runtime | After draw identity stable |
| **3I** | Scheduling and Resource Runtime | After match generation |
| **3J** | Match Lifecycle and Scoring Runtime | Highest operational risk |
| **3K** | Standings and Tie-break Runtime | Strong CC parity suite exists |
| **3L** | Publication Runtime | After schedule/draw lock semantics |
| **3M** | Production Cutover | Per-capability Owner GO |
| **3N** | Legacy Retirement | After Canonical SSOT + read-only window |

**Recommended Phase 3A:** Runtime Control Plane and Shadow Infrastructure  
**Alternative Phase 3A:** Participant Persistence Port Stubs (non-Production) — only if Owner wants persistence design before flags.

---

## Persistence recommendation

**Option C — Hybrid:** new canonical tables + compatibility views/projections on legacy blob/cloud during transition.

- Canonical IDs independent of legacy IDs  
- Mapping store required  
- Dual-write starts only after shadow parity gates  
- No SQL in Phase 3.0

---

## Owner gates before Phase 3A

```text
OG-3.0A Architecture approved
OG-3.0B Capability order approved
OG-3.0C Persistence strategy approved
OG-3.0D Feature flag hierarchy approved
OG-3.0E Shadow and parity model approved
OG-3.0F Pilot policy approved
OG-3.0G Rollback policy approved
OG-3.0H Phase 3A implementation approved
```

**Do not start Phase 3A without Owner GO on OG-3.0H.**

---

## Explicit non-claims

```text
No runtime migration started
No Production shadow hook wired
No feature flags implemented/enabled beyond existing OFF defaults
No database changes
No tenant or competition pilot
Competition Core is NOT Production SSOT
```

---

## Document index

| Doc | Topic |
|-----|-------|
| `01_CURRENT_RUNTIME_INVENTORY.md` | Stack and executor inventory |
| `02_RUNTIME_CALL_CHAIN_MAP.md` | UI → persistence call chains |
| `03_CAPABILITY_MIGRATION_MATRIX.md` | Per-capability status |
| `04_PHASE_3_SEQUENCE.md` | Ordered phases + exit criteria |
| `05_RUNTIME_CONTROL_PLANE.md` | Control plane design |
| `06_RUNTIME_MODE_STATE_MACHINE.md` | Modes LEGACY_ONLY → RETIRED |
| `07_SHADOW_EXECUTION_ARCHITECTURE.md` | Shadow isolation |
| `08_PARITY_AND_ACCEPTANCE_THRESHOLDS.md` | Comparators + thresholds |
| `09_PERSISTENCE_AND_SSOT_TRANSITION.md` | Persistence options + SSOT |
| `10_FEATURE_FLAGS_AND_KILL_SWITCH.md` | Flags + kill switch |
| `11_TENANT_AND_COMPETITION_ROLLOUT.md` | Rollout tiers |
| `12_ROLLBACK_AND_RECONCILIATION.md` | Rollback matrix |
| `13_OBSERVABILITY_AND_AUDIT.md` | Metrics + logs |
| `14_SECURITY_AND_AUTHORIZATION.md` | RLS/RBAC placement |
| `15_VERSIONING_AND_DETERMINISM.md` | Versions + execution context |
| `16_TRANSACTION_AND_EVENT_BOUNDARIES.md` | Tx + events |
| `17_RISK_REGISTER.md` | Risks |
| `18_OWNER_GATE_MATRIX.md` | Owner gates |
| `19_PHASE_3A_IMPLEMENTATION_PLAN.md` | Proposed 3A scope |
| `20_PHASE_3A_ENTRY_CRITERIA.md` | Entry checklist |

---

## Verdict

```text
PHASE 3.0 ARCHITECTURE READY FOR OWNER REVIEW
```
