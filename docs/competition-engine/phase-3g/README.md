# Phase 3G — Seeding Runtime

**Status:** Capability implemented (isolated). Integrator Wave not started.  
**Branch:** `feature/competition-engine-phase-3g-seeding-runtime`  
**Production callers:** NONE

## Capability root

`src/features/competition-core/seeding/**`

## Public surface (capability-local)

`seeding/index.js` — Option B. Root `competition-core/index.js` is **not** modified.

## Identity (Owner-locked)

```text
SEEDING identityKey = competitionId::SEEDING::contextId
CANDIDATE key       = seedingIdentityKey::CANDIDATE::candidateReference
ASSIGNMENT key      = seedingIdentityKey::SEED::{seedNumber}
```

## Ownership boundary

Seeding Runtime owns **candidate ordering and seed assignment only**.

Out of scope:

- Draw / snake / bracket / bye placement
- Matchup generation
- Ranking calculation
- Rating calculation
- Match / Scheduling / Court / Referee / Scoring / Standings runtimes

## Safety defaults

| Concern | Target |
|---------|--------|
| Production callers | NONE |
| Feature flags | OFF / unchanged |
| Shadow | OFF / default deny |
| Persistence | OFF |
| Runtime cutover | NOT PERFORMED |
| UI / API / SQL / RPC / Supabase | NONE |
| Runtime-control registration | NONE |
| Shared API error registry | NOT mirrored |
| Math.random | FORBIDDEN in Core |
| Root exports | NOT MODIFIED |
| Official CI manifest | NOT MODIFIED |

## Owner decisions locked

1. Runtime root `seeding/**`
2. Ordering + assignment only
3. Draw/snake/bracket/bye/matchup outside 3G
4. Ranking/Rating immutable external inputs
5. Deterministic identities as above
6. No `Math.random()`
7. Absent `deterministicSeed` → identity ordering
8. Partial manual seeds supported
9. Duplicate manual seeds rejected
10. Capability-local factories
11. Persistence OFF
12. No root exports
13. No official CI manifest change
14. No Integrator Wave
15. No Production callers
