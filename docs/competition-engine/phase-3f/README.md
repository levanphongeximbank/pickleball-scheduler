# Phase 3F — Match Runtime

**Status:** Capability implemented (isolated). Integrator Wave not started.  
**Branch:** `feature/competition-engine-phase-3f-match-runtime`  
**Production callers:** NONE

## Capability root

`src/features/competition-core/matches/**`

## Public surface (capability-local)

`matches/index.js` — Option B. Root `competition-core/index.js` is **not** modified.

## Identity (Owner-locked)

```text
MATCH identityKey = competitionId::MATCH::contextId
SIDE id           = matchIdentityKey::SIDE::{A|B}
```

Granularity: one `CompetitionMatch` = one playable contest (**TT SubMatch** level).

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
| Scoring / winner calculation | NOT IMPLEMENTED |
| Root exports | NOT MODIFIED |

## Owner decisions locked

1. Phase 3F = Match Runtime (Owner roadmap)
2. SubMatch granularity
3. Identity `competitionId::MATCH::contextId`
4. No winner calculation
5. Opaque `MatchResultReference` only
6. `LINEUPS_PENDING` optional / policy-specific
7. Capability-local factories
8. Persistence OFF
9. No root exports
10. No Integrator Wave
11. No Scoring Runtime
