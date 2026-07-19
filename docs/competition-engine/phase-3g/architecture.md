# Architecture — Phase 3G Seeding Runtime

## Layout

| Area | Path |
|------|------|
| Resolver | `seeding/SeedingResolver.js` |
| Contracts | `seeding/contracts/` |
| Services | `seeding/services/` |
| Adapters | `seeding/adapters/` (map-only) |
| Policies | `seeding/policies/` |
| Ports | `seeding/ports/` |
| Errors | `seeding/errors/` |
| Enums | `seeding/enums/` |

## Factory DI

```js
createSeedingResolver({
  adapters?,
  identityLookup?,
  persistence?,
  enablePersistence?, // default false
  seedingPolicy?,
  rankingResolver?,
  ratingResolver?,
  registrationResolver?,
  participantResolver?,
  teamResolver?,
  deterministicRandom?,
  clock?,
})
```

No singletons. No import-time registration.

## Ordering chain

1. Manual locked / protected seeds occupy their numbers
2. Remaining candidates ordered by:
   ranking position → rating value → source priority →
   deterministic tie key (if `deterministicSeed`) → candidate identity key
3. Free seed numbers filled ascending (partial manual support)

## Determinism

- Core never calls `Math.random()`
- Absent `deterministicSeed`: identity ordering
- Present `deterministicSeed`: injected / hash-based PRNG for ties only

## Persistence

Default OFF. Port methods: `getById`, `findByIdentityKey`, `listByCompetition`, `save`, `saveSnapshot`.
