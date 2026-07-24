# E2E-06 — File Ownership

## Owned (exclusive write)

| Path | Notes |
|------|-------|
| `src/features/competition-engine/operations/governance/**` | Facade, policy, projections, adapters, evidence |
| `src/features/competition-engine/presentation/governance/**` | View-model sections only |
| `docs/competition-engine/e2e-06/**` | This documentation set |
| `tests/competition-engine-e2e-06-governance-reliability.test.js` | Targeted tests |

## Shared (minimal additive edits only)

| Path | Allowed change |
|------|----------------|
| `src/features/competition-engine/operations/index.js` | Selective re-export of governance public surface |
| `src/features/competition-engine/presentation/index.js` | Export `buildGovernanceReliabilitySections` |
| `scripts/ci/unit-test-files.json` | Register E2E-06 test file |

## Forbidden (consume only)

- `operations/organizer/**` (E2E-03)
- `operations/player/**`, `operations/referee/**` (E2E-04)
- `operations/public/**`, `presentation/public/**` (E2E-05)
- `docs/competition-engine/e2e-00/**` … `e2e-05/**`
- Competition Core internal algorithms
- Platform Governance & Operations registry / incident product
- `package.json` / `package-lock.json` (unchanged)

## Invariants

1. No parallel workflow/audit/replay/import-export/recovery engines.
2. No direct Supabase access in new boundary.
3. No client-grant trust.
4. No archive delete/purge; no direct CM archive mutation.
5. `wiredToProductionRuntime: false` for MVP facade.
