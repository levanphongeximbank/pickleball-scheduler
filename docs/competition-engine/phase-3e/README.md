# Phase 3E — Lineup Resolution Runtime

**Status:** Capability implemented (isolated). Integrator Wave not started.  
**Branch:** `feature/competition-engine-phase-3e-lineup-runtime`  
**Production callers:** NONE

## Capability root

`src/features/competition-core/lineups/**`

## Public surface (capability-local)

`lineups/index.js` — Option B. Root `competition-core/index.js` is **not** modified.

## Identity (Owner-locked)

```text
LINEUP identityKey = competitionId::LINEUP::contextId::teamId
SLOT id            = lineupIdentityKey::disciplineOrSideKey::index
```

## Safety defaults

| Concern | Target |
|---------|--------|
| Production callers | NONE |
| Feature flags | OFF / unchanged |
| Shadow | OFF / default deny |
| Persistence | OFF |
| Runtime cutover | NOT PERFORMED |
| UI / API / SQL / RPC / Supabase | NONE |

## Integrator handoff (later)

1. Re-export from `competition-core/index.js`
2. Merge `scripts/ci/unit-test-files.phase-3e.json` into official manifest
3. Optional shared error-registry mirror
4. Do **not** enable flags, Shadow, Production callers, or persistence
