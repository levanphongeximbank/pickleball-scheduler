# Architecture — Phase 3H Draw Runtime

## Layout

| Area | Path |
|------|------|
| Resolver | `draw-runtime/DrawResolver.js` |
| Contracts | `draw-runtime/contracts/` |
| Services | `draw-runtime/services/` |
| Adapters | `draw-runtime/adapters/` (map-only) |
| Policies | `draw-runtime/policies/` |
| Ports | `draw-runtime/ports/` |
| Errors | `draw-runtime/errors/` |
| Enums | `draw-runtime/enums/` |

## Factory DI

```js
createDrawResolver({
  adapters?,
  identityLookup?,
  persistence?,
  enablePersistence?, // default false
  drawPolicy?,
  seedingResolver?, // accepted but NOT called by default
  participantResolver?,
  entryResolver?,
  teamResolver?,
  constraintResolver?,
  deterministicRandom?,
  clock?,
})
```

No singletons. No import-time registration.

## Placement pipeline

1. Merge candidates and/or seedAssignments (join when both)
2. Apply manual/protected overlays (no last-write-wins)
3. Validate candidates + layout params
4. Policy eligibility filter
5. Place:
   - Groups: seeded / snake / serpentine / pot / open / manual
   - Bracket: seeded or open slots + first-class byes
6. Identity register + optional persistence snapshot

## Determinism

- Core never calls `Math.random()`
- Absent `deterministicSeed`: identity ordering
- Present `deterministicSeed`: injected / hash-based PRNG (mulberry32)

## Persistence

Default OFF. Port methods: `getById`, `findByIdentityKey`, `listByCompetition`, `listByContext`, `save`, `saveSnapshot`.

## Snake vs Serpentine

| Mode | First row direction |
|------|---------------------|
| `SNAKE_GROUPS` | 0 → n-1, then reverse |
| `SERPENTINE_GROUPS` | n-1 → 0, then forward |

## Pot semantics (`POT_GROUPS`)

True per-pot processing (not a global uninterrupted snake):

1. Group candidates by `seedTier` (null/missing → untiered pot, sorted last)
2. For each pot in lexicographic tier order:
   - deterministic order inside pot (`seedNumber`, then identity key)
   - **reset** snake step to 0
   - distribute that pot independently across groups
3. Manual/protected reserved placements are applied first and never moved
4. Group capacity is enforced across pots

Equal pots of size = `groupCount` yield one member of each tier per group when capacity permits.

## Manual / protected overlays

- Duplicate manual placement for the same candidate → `DRAW_MANUAL_PLACEMENT_DUPLICATE`
- Protected vs manual coordinate conflict → `DRAW_PROTECTED_PLACEMENT_CONFLICT`
- Never last-write-wins

## Top-seed bye policy (`SEEDED_BRACKET`)

1. Place candidates into classic seed→slot positions
2. `byeCount = bracketSize - eligibleCount`
3. Free slots = slots of missing lower seeds = first-round opponents of top seeds
4. Emit first-class `DrawBye` for each free slot (deterministic list order)
5. No matchups are created to infer bye recipients

## HYBRID mode

`HYBRID` remains in the enum for Integrator-owned composition.  
Draw Runtime Core **rejects** executable `HYBRID` with `DRAW_UNSUPPORTED_MODE`.

## Legacy draw/**

CC-04 foundation under `competition-core/draw/**` is **read-only**. Phase 3H does not modify it.
