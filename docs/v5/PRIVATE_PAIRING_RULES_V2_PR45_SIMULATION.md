# PR-4.5 — AI Pairing Simulation Engine

## Status

Implemented on worktree `pickleball-scheduler-pr45-private-pairing` / branch `feature/private-pairing-rules-v2`.

Production flags remain **OFF**. No migration, backfill, merge, or deploy.

## Architecture

```
simulatePrivatePairing(input)
  → flag gates (simulation + PR-3 runtime)
  → filterEligibleSimulationPlayers (MAPPED/DERIVED only)
  → resolveActivePrivatePairingRules (scope/time/certified policy)
  → generateSimulationCandidates (team or match/Daily Play)
  → scoreSimulationCandidate (PR-3 hard/soft + diversity/fairness)
  → explainSimulationCandidate
  → Top N ranked envelope (read-only)
  → optional audit SIMULATE_PRIVATE_PAIRING
```

Modules under `src/features/private-pairing-rules/simulation/`:

| Module | Role |
|--------|------|
| `simulatePrivatePairing.js` | Orchestrator |
| `candidateGenerator.js` | Seeded team/match candidates |
| `candidateScorer.js` | Hard reject + soft/balance/fairness/diversity |
| `candidateExplainer.js` | Stable explanation codes |
| `candidateCanonicalizer.js` | Player eligibility + deterministic keys |
| `privatePairingSimulationAudit.js` | Redacted audit payload |

## Feature flags

| Flag | Default |
|------|---------|
| `VITE_PRIVATE_PAIRING_SIMULATION_ENABLED` | `false` |
| `VITE_PRIVATE_PAIRING_RULES_ENABLED` | `false` |
| `VITE_UNIFIED_CONSTRAINT_ENGINE_ENABLED` | `false` |
| `VITE_CANONICAL_*` | used by callers to build player pool |

When simulation flag OFF → returns `SIMULATION_FEATURE_DISABLED`, no candidate search.

## Canonical input

Callers should load players via `CanonicalPlayerRepository` / `canonicalPlayerPickerAdapter`. Simulation itself does **not** call `loadPlayersForClub` / blob.

Only `MAPPED` / `DERIVED` enter candidates. `UNMAPPED` / `INVALID` → warnings + mapping summary.

## Read-only guarantee

Simulation never writes:

- tournament entries, matches, lineups, court assignments, draws
- `club_data_v3`, founder constraints, active rule sets, player mappings

Optional audit action: `SIMULATE_PRIVATE_PAIRING` (counts/IDs only).

## Search defaults

`maxCandidates=5000`, `maxIterations=50000`, `timeoutMs=2000`, `topN=10` (clamped 1..50).

## Rollback

Keep `VITE_PRIVATE_PAIRING_SIMULATION_ENABLED=false` (default). Revert PR-4.5 commits if needed. No DB rollback.

## Known limitations

- No SUPER_ADMIN full UI / Apply button (deferred).
- Diversity scoring is history/heuristic based, not exhaustive search.
- Balance still uses PR-3 fallback numeric path when rating missing; warnings + confidence reduction are emitted.
- Worktree shares `node_modules` junction with main repo for local test runs.
