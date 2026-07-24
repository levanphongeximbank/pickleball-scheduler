# E2E-05 — File Ownership Lock

## Owned by E2E-05 (this workstream)

| Path | Role |
|------|------|
| `src/features/competition-engine/operations/public/**` | Public Experience facade, gates, projections, allowlists |
| `src/features/competition-engine/presentation/public/**` | Public portal section view-model adapters |
| `docs/competition-engine/e2e-05/**` | E2E-05 docs only |
| `tests/competition-engine-e2e-05-*.test.js` | Targeted E2E-05 tests |

## Shared / re-export only (touch carefully)

| Path | Rule |
|------|------|
| `src/features/competition-engine/operations/index.js` | Re-export public barrel; do not change Organizer/Player contracts |
| `src/features/competition-engine/presentation/index.js` | Re-export public view-models alongside organizer |
| `src/features/competition-engine/index.js` | Already re-exports operations/presentation — no structural change required |
| `scripts/ci/unit-test-files.json` | Add E2E-05 test entry only |

## Read-only reuse (no ownership transfer)

- E2E-01: `integration/**`, `createCompetitionRuntimePorts` (tenant scope checks only)
- E2E-02: pool/knockout composition fingerprints and summaries (consume published snapshots)
- E2E-03: Organizer publication states / store records as published source — **consume**, do not mutate
- CM-06 Publication / CM-05 Branding / CM-08 Archive — readiness/manifest contracts only
- CORE schedule / court / standings / result validation / workflow — via published snapshots only
- Legacy UI: `IndividualTournamentPublicPage`, `publicPortalService`, bracket/schedule panels — adapter/view-model only

## Forbidden (stop / escalate)

- `docs/competition-engine/e2e-00` … `e2e-03` edits
- E2E-04 paths: `operations/player/**`, `operations/referee/**`, `presentation/player/**`, `presentation/referee/**`
- `package.json` / `package-lock.json`
- Direct Supabase imports in new public domain/application boundary
- Parallel standings / bracket / schedule / lifecycle / winner engines
- Organizer mutation commands from public surfaces
- Deep Core/CM/E2E-03 contract rewrites
- Global router/shell/provider redesign
- SQL / deploy / secrets
