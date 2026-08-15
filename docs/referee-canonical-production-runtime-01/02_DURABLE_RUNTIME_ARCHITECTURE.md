# Durable runtime architecture

```
Competition Adapter B (not this workstream)
        ↓
competition.referee.adapter.v1  (LOCKED 1.0.0)
        ↓
E2E-04 Referee Operations
        ↓
CORE-13 / CORE-15 / CORE-16 / CORE-17
        ↓
Canonical Runtime Ports
        ↓
Durable driver (V5 tables / internal commit RPC)
        ↓
referee_assignments
match_live_states
match_events
match_result_revisions
match_sync_mutations
```

## Composition

`createCompetitionRefereeProductionRuntime({ durableDriver })`

Fail-closed if:

- durableDriver missing
- durableDriver.durable !== true
- in-memory ops store / Map persistence runtime passed as production
- schema-faithful test driver used without `allowTestDoubleDriver: true`

In-memory remains TEST_DOUBLE_ONLY. No production fallback.

## Authorities (one each)

- CORE-13 assignment decisions; table stores the result
- CORE-15 lifecycle
- CORE-16 scoring
- CORE-17 accepted official result

Referee V5 scoring/lifecycle/finalize engines are not called.

## Drivers

| Driver | Classification | Role |
|---|---|---|
| schema-faithful ledger | TEST_DOUBLE_ONLY, durable=true | local certification of live SQL semantics |
| live RPC (`referee_v5_commit_*`) | DURABLE_PRODUCTION | later Staging GO; service-role only |

`wiredToProductionRuntime=false` until live Staging backend GO.

## V5 classification

| Asset | Class |
|---|---|
| V5 tables, commit/get RPCs, append-only trigger, match_sync_mutations | REUSE_CANONICAL_INFRASTRUCTURE |
| RefereeV5RpcAtomicCommitService / internal RPC client | REUSE_CANONICAL_INFRASTRUCTURE |
| V5 scoring/lifecycle/finalize engines | COMPATIBILITY_ONLY |
| referee_v5_assert_assignment_write / apply_admin_result_revision | COMPATIBILITY_ONLY (Team) |
| InMemoryMatchRepository / E2E-04 in-memory store | TEST_ONLY |
| Token referee + tournament_match_live | COMPATIBILITY_ONLY |
| Team #418 RPCs | STILL_REQUIRED / do not change |
| incidents/disputes/device/positions/outbox | NOT_REQUIRED for this runtime |
