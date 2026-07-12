# CC-04D — Draw Runtime Adapter

**Phase:** CC-04D | **Runtime algorithms:** NOT changed

## Purpose

Connect CC-04A/B/C draw foundation to legacy runtime via an adapter layer. When `VITE_COMPETITION_CORE_DRAW_V2_ENABLED` is ON, requests and results pass through canonical contracts and decision trace before/after the same legacy executor.

## Flow

```
evaluateCanonicalDraw()
  → build DrawRequest / StrategyDrawRequest
  → Strategy selection + policy derivation
  → Legacy executor (unchanged algorithm)
  → map legacy groups → DrawResult
  → adapt back to legacy consumer shape
  → decision trace + audit
```

## Flag gate

| Flag | Path |
|------|------|
| OFF | Direct `legacyExecutor(payload)` — 100% legacy |
| ON | Canonical adapter wraps same `legacyExecutor` |

Requires master flag `VITE_COMPETITION_CORE_ENABLED=true`.

## Module

`src/features/competition-core/draw/adapters/`

| File | Role |
|------|------|
| `drawRuntimeInventory.js` | Runtime call graph audit |
| `legacyDrawPayloadMappers.js` | Legacy → canonical request |
| `legacyDrawResultMappers.js` | Legacy ↔ canonical result |
| `drawDecisionTrace.js` | Runtime decision trace |
| `drawRuntimeAdapter.js` | `evaluateCanonicalDraw()` |

## Production hooks (data path only)

- `buildInternalTournamentPlan` → `runLegacyDrawWithCanonicalAdapter`
- `buildOfficialOpenPlan` → `runLegacyDrawWithCanonicalAdapter`
- `buildOfficialAiBalancePlan` → `runLegacyDrawWithCanonicalAdapter`
- `executeCompetitionEngine(DRAW)` → `evaluateCanonicalDraw` when v2 path

## Out of scope

- Algorithm rewrite (snake, balance, open random)
- Deploy / migration
- CC-05
