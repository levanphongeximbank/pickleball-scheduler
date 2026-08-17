# In-memory retirement matrix

PRODUCTION_IN_MEMORY_FALLBACK=NO  
TEST_IN_MEMORY_RUNTIME_AVAILABLE=YES

| Surface | Before | After |
|---|---|---|
| `createRefereeCompetitionOperationsFacade()` no store | auto in-memory | fail closed |
| `createDefaultCompetitionRefereeRuntime()` no driver | n/a | fail closed |
| `createCompetitionRefereeProductionRuntime({ durableDriver: in-memory })` | forbidden | forbidden |
| schema-faithful without `allowTestDoubleDriver` | forbidden | forbidden |
| explicit `store: createInMemoryRefereeOperationsStore()` | allowed | allowed (TEST_DOUBLE_ONLY) |
| E2E-04 unit tests | implicit in-memory | explicit in-memory DI |
| E2E-07 certification scenarios | implicit in-memory | explicit in-memory DI |
| Map `createCanonicalRefereePersistenceRuntime` | injectable, not default | unchanged, not default |
| localStorage match authority | not used by E2E-04 | still forbidden |
| dual scoring / dual result writes | forbidden | forbidden |

In-memory remains a test double. It is not a production fallback when durable runtime is unavailable.
