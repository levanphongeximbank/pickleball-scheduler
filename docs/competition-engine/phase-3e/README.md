# Phase 3E — Lineup Resolution Runtime

**Status:** Capability implemented. Integrator Wave complete (root export + official CI).  
**Integrator branch:** `integration/competition-engine-phase-3e-wave-1`  
**Production callers:** NONE

## Capability root

`src/features/competition-core/lineups/**`

## Public surface

- Capability-local: `lineups/index.js`
- Root (Integrator): `competition-core/index.js` re-exports approved allowlist only

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
| Runtime-control registration | NONE |
| Shared API error registry | NOT mirrored |

## Integrator Wave (done)

1. Re-export allowlist from `competition-core/index.js`
2. Merge Phase 3E tests + integrator smoke into official `unit-test-files.json`
3. Shared error-registry mirror: skipped (capability-local + root typed errors only)
4. Flags / Shadow / Production callers / persistence: unchanged OFF
