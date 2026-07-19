# Phase 3H — Draw Runtime

**Status:** Capability implemented (isolated). Integrator Wave not started.  
**Branch:** `feature/competition-engine-phase-3h-draw-runtime`  
**Production callers:** NONE

## Capability root

`src/features/competition-core/draw-runtime/**`

## Public surface (capability-local)

`draw-runtime/index.js` — Option B. Root `competition-core/index.js` is **not** modified.

## Identity (Owner-locked)

```text
DRAW identityKey     = competitionId::DRAW::contextId
CANDIDATE key        = drawIdentityKey::CANDIDATE::candidateReference
GROUP key            = drawIdentityKey::GROUP::{groupNumber}
BRACKET key          = drawIdentityKey::BRACKET::{bracketId}
SLOT key             = drawIdentityKey::SLOT::{slotNumber}
PLACEMENT key        = drawIdentityKey::PLACEMENT::{candidateIdentityKey}
BYE key              = drawIdentityKey::BYE::{slotNumber}
```

## Ownership boundary

Draw Runtime owns **placement only** (groups, bracket slots, byes).

Out of scope:

- Seeding calculation (consumes immutable SeedAssignment references)
- Matchup / match / fixture / round generation
- Scheduling / courts / scores / standings
- Ranking / rating calculation
- Workflow publication
- UI rendering

## Owner decisions locked

1. Root `draw-runtime/**` — do not modify legacy `draw/**`
2. Placement only
3. MVP: seeded / snake / serpentine / open / pot groups + manual/protected + bracket + byes
4. Snake ≠ Serpentine (separate modes)
5. Pot = **true per-tier pots** (reset snake per pot; not global uninterrupted snake)
6. Accept candidates only, seedAssignments only, or both (join on candidateIdentityKey)
7. No SeedingResolver call by default
8. No `Math.random()`
9. Absent `deterministicSeed` → identity ordering
10. Bye is first-class `DrawBye` with top-seed-compatible seeded bracket policy
11. `positionNumber` is first-class on `DrawPlacement`
12. Persistence OFF
13. No root exports / official CI manifest / Integrator Wave / Production callers
14. Protected/manual conflicts reject (`DRAW_PROTECTED_PLACEMENT_CONFLICT`)
15. Duplicate manual for same candidate rejects (`DRAW_MANUAL_PLACEMENT_DUPLICATE`)
16. `HYBRID` enum retained; **not executable** in Core (Integrator-owned)

## Safety defaults

| Concern | Target |
|---------|--------|
| Production callers | NONE |
| Feature flags | OFF / unchanged |
| Persistence | OFF |
| Runtime cutover | NOT PERFORMED |
| UI / API / SQL / RPC / Supabase | NONE |
| Runtime-control registration | NONE |
| Math.random | FORBIDDEN in Core |
| Root exports | NOT MODIFIED |
| Official CI manifest | NOT MODIFIED |
| Legacy `draw/**` | NOT MODIFIED |
