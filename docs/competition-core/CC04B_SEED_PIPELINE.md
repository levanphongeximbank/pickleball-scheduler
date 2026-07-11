# CC-04B — Canonical Seed Pipeline

**Phase:** CC-04B | Foundation only | No runtime

---

## Pipeline

```
Input (SeedRequest)
  ↓ Normalize participants
  ↓ Resolve rating source
  ↓ Resolve adjustments
  ↓ Compute canonical seed score (reference model)
  ↓ Seed rank
  ↓ Tie-break
  ↓ Seed object (CanonicalSeedObject)
```

Entry: `runCanonicalSeedPipeline()` in `src/features/competition-core/seed/seedPipeline.js`

Does **not** call `seedEngine.js`, `assignSeedsToEntries`, or draw/snake runtime.

---

## Stages

| Stage | Constant |
|-------|----------|
| Input | `SEED_PIPELINE_STAGE.INPUT` |
| Normalize | `NORMALIZE` |
| Resolve rating source | `RESOLVE_RATING_SOURCE` |
| Resolve adjustments | `RESOLVE_ADJUSTMENTS` |
| Compute score | `COMPUTE_SCORE` |
| Assign rank | `ASSIGN_RANK` |
| Tie-break | `TIE_BREAK` |
| Build seed object | `BUILD_SEED_OBJECT` |
