# Local certification

DEFAULT_RUNTIME_WIRING_IMPLEMENTED=YES  
PRODUCTION_DEFAULT_RUNTIME=DURABLE  
PRODUCTION_IN_MEMORY_FALLBACK=NO  
TEST_IN_MEMORY_RUNTIME_AVAILABLE=YES  
WIRED_TO_PRODUCTION_RUNTIME=true  
MIGRATION_DELTA_REQUIRED=NO  
STAGING_APPLICATION_PATH_CERTIFIED=NO  
STAGING_MUTATIONS=0  
PRODUCTION_ACCESSED=NO

## Required proofs

| # | Proof | Result |
|---|---|---|
| 1 | production default creates durable runtime | PASS |
| 2 | production runtime dependencies required | PASS |
| 3 | production missing dependency fails closed | PASS |
| 4 | production never falls back to in-memory | PASS |
| 5 | explicit in-memory test double still works | PASS |
| 6 | `wiredToProductionRuntime=true` only on durable default path | PASS |
| 7 | canonical auth identity preserved | PASS |
| 8 | tenant scope preserved | PASS |
| 9 | assignment scope preserved | PASS |
| 10 | expectedVersion path preserved | PASS |
| 11 | idempotency preserved | PASS |
| 12 | append-only event path preserved | PASS |
| 13 | CORE-17 result revision path preserved | PASS |
| 14 | fresh-read reconstruction supported | PASS |
| 15 | no direct privileged browser RPC | PASS |
| 16 | no service-role secret exposed to browser | PASS |
| 17 | no duplicate scoring authority | PASS |
| 18 | no duplicate result authority | PASS |
| 19 | Team regression | run with Team referee/Dreambreaker suites |
| 20 | Adapter Contract v1 unchanged (`1.0.0` locked) | PASS |

Primary suite: `tests/competition-engine-referee-canonical-default-runtime-cutover-01.test.js` (side-loaded from E2E-04).

Repo gates (this run):

- `npm run lint:no-new` PASS
- `npm run ci:competition-architecture-lock` PASS
- `npm run build` PASS
- `npm run test:unit` PASS

End A contract files under `integration/referee/contract.js` and locked constants (`CONTRACT_ID`, `CONTRACT_VERSION`, required/forbidden methods) were not changed.
