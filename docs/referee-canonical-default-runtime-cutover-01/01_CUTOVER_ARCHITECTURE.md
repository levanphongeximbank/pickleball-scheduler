# Cutover architecture

One shared canonical composition boundary:

`createDefaultCompetitionRefereeRuntime(options)`

It always constructs `createCompetitionRefereeProductionRuntime`. It never constructs in-memory.

## Production

```
durableDriver or rpcClient
  → createDefaultCompetitionRefereeRuntime
  → createCompetitionRefereeProductionRuntime
  → durable runtime + E2E-04 facade
  → wiredToProductionRuntime=true
```

Missing dependency → fail closed (`REFEREE_ADAPTER_DURABLE_DEPENDENCY_REQUIRED`).

In-memory / Map persistence / schema-faithful without `allowTestDoubleDriver` → fail closed (`REFEREE_ADAPTER_IN_MEMORY_PRODUCTION_FORBIDDEN`).

Live `rpcClient` path → server/Edge only (browser rejected).

## Test

```
createRefereeCompetitionOperationsFacade({
  store: createInMemoryRefereeOperationsStore(...),
  runtimePorts,
})
```

`wiredToProductionRuntime=false` on that facade.

Schema-faithful local certification of the same default function:

```
createDefaultCompetitionRefereeRuntime({
  durableDriver: createSchemaFaithfulCanonicalRefereeDurableDriver(...),
  allowTestDoubleDriver: true,
})
```

## Authorities (unchanged)

| Concern | Authority |
|---|---|
| Identity | `auth.uid` / `actor.actorId` |
| Assignment | CORE-13 |
| Lifecycle | CORE-15 |
| Scoring | CORE-16 |
| Official result | CORE-17 |

Referee V5 scoring/lifecycle/finalize engines are not called.

Adapter B is not implemented in this workstream.

Team parent/child/Dreambreaker policy stays in Team modules.

## `wiredToProductionRuntime`

True means:

- default application composition uses durable production runtime
- production runtime dependencies are mandatory
- no implicit in-memory fallback
- canonical persistence is the operational path
- auth / tenant / assignment / expectedVersion / idempotency remain enforced

Set true on:

- `createDefaultCompetitionRefereeRuntime` result
- `createCompetitionRefereeProductionRuntime` result and its facade
- `COMPETITION_ENGINE_REFEREE_OPERATIONS`
- `COMPETITION_REFEREE_ADAPTER_INTEGRATION`

Remains false on:

- explicit in-memory facade
- `createCanonicalRefereePersistenceRuntime`
- E2E-07 certification harness marker
