# CC-04A — Draw Domain Model

**Phase:** CC-04A | Pure domain only | No UI / Supabase / runtime

---

## Objects

| Object | Purpose |
|--------|---------|
| `DrawRequest` | Input: mode, entries, seeds, constraints, strategies, random metadata |
| `DrawResult` | Output: groups, candidates, explanations, conflicts, audit |
| `DrawCandidate` | One candidate grouping with score + feasibility |
| `DrawGroup` | Group id/label/entries/seeds/average |
| `DrawSeed` | Seed number + source metrics |
| `DrawMetadata` | Timing, versions, mode, strategy, random seed |
| `DrawAudit` | Request snapshot, distribution path, retries, selected candidate |
| `DrawConstraint` | Draw-scoped constraint contract |
| `DrawExplanation` | Explainability chain for placements |
| `DrawConflict` | Unsatisfiable / conflicting draw constraints |
| `DrawScoreBreakdown` | Heuristic / balance / penalty components |
| `DrawEngineResult` | Envelope (`success`, `enabled`, `executionPath`) |

Factories live in `src/features/competition-core/draw/drawContracts.js`.

---

## Principles

1. Pure objects — no side effects on import.
2. Clone nested structures in factories.
3. Flag OFF / foundation path does not execute draw algorithms.
4. Existing CC-01 `DRAW_MODE` remains unchanged; canonical modes are separate.
