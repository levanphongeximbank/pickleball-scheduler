# Default composition audit

Workstream: referee-canonical-default-runtime-cutover-01  
Starting HEAD: `0ed70e8924f23b2b8d32bc692031644019acb1c2` (`origin/main`, PR #433)

CURRENT_DEFAULT_RUNTIME_BEFORE=IN_MEMORY_FALLBACK

## Composition graph (after cutover)

```
Competition Mode Adapter B (NOT this workstream)
        ↓
competition.referee.adapter.v1  (LOCKED 1.0.0)
        ↓
E2E-04 createRefereeCompetitionOperationsFacade
        ↓
CORE-13 / CORE-15 / CORE-16 / CORE-17
        ↓
createDefaultCompetitionRefereeRuntime   ← canonical application composition root
        ↓
createCompetitionRefereeProductionRuntime
        ↓
createCanonicalRefereeDurableRuntime
        + createDurableRefereeOperationsStore
        ↓
durableDriver:
  live-rpc (rpcClient, server/Edge injected)
  OR schema-faithful (TEST_DOUBLE_ONLY, allowTestDoubleDriver: true)
        ↓
referee_assignments / match_live_states / match_events
match_result_revisions / match_sync_mutations
```

## Inventory

| Path | Classification | Notes |
|---|---|---|
| `createDefaultCompetitionRefereeRuntime` | C. PRODUCTION_APPLICATION | One shared composition root. Requires `durableDriver` or `rpcClient`. Fail closed if missing. |
| `createCompetitionRefereeProductionRuntime` | C. PRODUCTION_APPLICATION builder | Inner builder. Rejects in-memory. `wiredToProductionRuntime=true`. |
| `createCanonicalRefereeDurableRuntime` | C. production ports | Building block. Not the default by itself. |
| `createDurableRefereeOperationsStore` | C. production ops store | Fresh-read reconstruction from durable snapshots. |
| `createLiveRpcCanonicalRefereeDurableDriver` | C. live driver | Server/Edge only. Requires `rpcClient.rpc`. Browser rejected. |
| `createSchemaFaithfulCanonicalRefereeDurableDriver` | A. TEST_ONLY | Durable semantics, not live DB. Production default refuses unless `allowTestDoubleDriver`. |
| `createCanonicalRefereePersistenceRuntime` | A. TEST_ONLY / D. COMPAT | Map-backed production-capable injectable. Not default. |
| `createInMemoryRefereeOperationsStore` | A. TEST_ONLY | Explicit test DI only. |
| `createRefereeCompetitionOperationsFacade()` with no store | forbidden | Fail closed `E2E04_REFEREE_PRECONDITION_FAILED`. |
| E2E-07 happy/fail-closed certification | A. TEST_ONLY | Explicit in-memory store injected. |
| E2E-04 unit tests | A. TEST_ONLY | Explicit in-memory store injected. |
| `referee-v5-match` Edge | D. COMPATIBILITY_ONLY I/O | Existing privileged V5 scoring/finalize path. Not E2E-04 authority. Holds service-role on Edge. |
| `refereeV5EdgeClient` | D. browser intent | Authenticated user intent only. No internal commit RPC. |
| `refereeV5InternalRpcService` | D. server/test | Browser guard `INTERNAL_RPC_FORBIDDEN`. |
| Daily/Internal/Official/Team Adapter B | E / later workstreams | Not implemented here. |
| React referee pages | D. UI / V5 prototype | Do not import default durable composition. |

## Who supplies dependencies

- Application/backend host injects `rpcClient` (service-role, server/Edge env) or a durable driver.
- Tests inject schema-faithful driver with `allowTestDoubleDriver: true`, or explicit in-memory store into the facade.
- Browser must not supply service-role. Vite env service-role bags are refused.

## Browser / privileged RPC

- No page imports `createDefaultCompetitionRefereeRuntime` or live RPC driver.
- No `SUPABASE_SERVICE_ROLE_KEY` in client surfaces.
- Internal commit RPC names are not called from `refereeV5EdgeClient`.
- Existing Edge `referee-v5-match` remains the deployed privileged V5 HTTP boundary.

## Silent in-memory fallback (before)

`createRefereeCompetitionOperationsFacade` constructed `createInMemoryRefereeOperationsStore` when `store` / `runtime.opsStore` were missing.

That path is removed.
