# E2E-04 — Player & Referee Operations MVP

Production-oriented Player + Referee operations for **INDIVIDUAL TOURNAMENT — POOL + KNOCKOUT**.

## Status

| Item | State |
|------|-------|
| Player Operations facade | Implemented |
| Referee Operations facade | Implemented |
| Player check-in (E2E-03 window compatible) | Implemented |
| Referee assignment enforcement | Implemented (CORE-13 handoff) |
| Match lifecycle control | Reuses CORE-15 |
| Scoring / Result Validation handoff | Reuses CORE-16 / CORE-17 |
| Presentation view-models | Minimal adapters |
| Wired to production runtime | `false` (MVP boundary) |

## Docs index

| File | Purpose |
|------|---------|
| [00_FILE_OWNERSHIP.md](./00_FILE_OWNERSHIP.md) | Ownership lock |
| [00_E2E_04_IMPLEMENTATION_REPORT.md](./00_E2E_04_IMPLEMENTATION_REPORT.md) | Implementation report |
| [01_PLAYER_REFEREE_CONTRACTS.md](./01_PLAYER_REFEREE_CONTRACTS.md) | Facade contracts |
| [02_LEGACY_REUSE_MAP.md](./02_LEGACY_REUSE_MAP.md) | Legacy inventory |
| [03_PERMISSION_AND_TENANT_MATRIX.md](./03_PERMISSION_AND_TENANT_MATRIX.md) | Permission matrix |
| [04_SCORING_VALIDATION_FLOW.md](./04_SCORING_VALIDATION_FLOW.md) | Scoring / validation flow |
| [05_BLOCKER_RESOLUTION.md](./05_BLOCKER_RESOLUTION.md) | Blockers |
| [06_TEST_EVIDENCE.md](./06_TEST_EVIDENCE.md) | Test evidence |
| [07_E2E_06_READINESS.md](./07_E2E_06_READINESS.md) | E2E-06 readiness |

## Public entry

```js
import {
  createPlayerCompetitionOperationsFacade,
  createRefereeCompetitionOperationsFacade,
  buildPlayerPortalSections,
  buildRefereePortalSections,
} from "../src/features/competition-engine/index.js";
```

## Out of scope

Organizer mutations (E2E-03), Public Experience (E2E-05), SQL remote, notification delivery, payment, CRM, full dispute UI.
