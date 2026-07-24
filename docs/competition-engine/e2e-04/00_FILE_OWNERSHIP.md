# E2E-04 — File Ownership Lock

## Owned by E2E-04 (this workstream)

| Path | Role |
|------|------|
| `src/features/competition-engine/operations/player/**` | Player Operations facade, authz, check-in, projection |
| `src/features/competition-engine/operations/referee/**` | Referee Operations facade, assignment enforcement, scoring handoff |
| `src/features/competition-engine/presentation/player/**` | Player Portal MVP view-model adapters |
| `src/features/competition-engine/presentation/referee/**` | Referee Hub MVP view-model adapters |
| `docs/competition-engine/e2e-04/**` | E2E-04 docs only |
| `tests/competition-engine-e2e-04-*.test.js` | Targeted E2E-04 tests |

## Shared / re-export only (touch carefully)

| Path | Rule |
|------|------|
| `src/features/competition-engine/operations/index.js` | Re-export player/referee barrels; do not change Organizer contracts |
| `src/features/competition-engine/presentation/index.js` | Re-export player/referee view-models |
| `src/features/competition-engine/index.js` | Already re-exports operations/presentation — no structural change required |

## Read-only reuse (no ownership transfer)

- E2E-01: `integration/**`, `createCompetitionRuntimePorts`
- E2E-02: `application/createPoolKnockoutRuntimeComposition`, composition
- E2E-03: Organizer facade/store/check-in window constants — **consume**, do not mutate contracts
- CORE-13 Referee Assignment, CORE-15 Matches, CORE-16 Scoring, CORE-17 Result Validation, CORE-18 Standings, CORE-19 Workflow
- Identity permissions / roles
- Legacy UI: `IndividualPlayerPortalPage`, `Player*Panel`, `RefereeHub`, `referee-v5/**` — adapter/view-model only

## Forbidden (stop / escalate)

- `docs/competition-engine/e2e-00` … `e2e-03` edits
- E2E-05 Public Experience paths / `operations/public/**` / public live surfaces
- `package.json` / `package-lock.json`
- Direct Supabase imports in new application boundary
- Parallel score / result / standings / lifecycle / assignment engines
- Deep Core/CM/E2E-03 contract rewrites
- Global router/shell/provider redesign
