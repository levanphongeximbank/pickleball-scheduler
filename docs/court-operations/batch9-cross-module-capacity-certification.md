# Batch 9 — Cross-module capacity certification

**NOT A STAGING CUTOVER.**  
`STAGING_SQL_APPLIED=NO` · `PRODUCTION_SQL_APPLIED=NO` · all canonical defaults remain `false`.

```
CERTIFICATION_DATE=2026-08-16
TESTED_HEAD=bef7ed25a2df702f95e92095ed81b5ed82d47c78
BRANCH=feat/court-resource-phase3b-canonical-reservation-01
PR=438 (OPEN, DRAFT, UNMERGED)
BASE_ORIGIN_MAIN=930d17d47e61375dd4cbcbd61659f88440c8ed67
```

## Environment

```
CERTIFICATION_ENVIRONMENT=embedded-postgres-local/cr_p3b_batch9
REAL_POSTGRES_USED=YES
STAGING_USED=NO
PRODUCTION_USED=NO
DATABASE_NAME_PREFIX=cr_p3b_
HOST=127.0.0.1:55434
INITDB=UTF8 locale=C
```

Isolated cluster only. Safety gate rejects Staging `qyewbxjsiiyufanzcjcq` and Production `expuvcohlcjzvrrauvud`.

Canonical SQL packages loaded (authored bytes, unmodified):

| Package | Role | PRECHECK | APPLY | VERIFY |
| --- | --- | --- | --- | --- |
| Phase 3A `court-resource-post427-canonical-reconciliation-01` | Court Master / Access | skipped (empty DB) | YES | skipped |
| Phase 3B `court-resource-phase3b-canonical-reservation-01` | Capacity SSOT | YES | YES | YES |
| Batch 1 inventory read | Eligible courts RPC | YES | YES | YES |
| Batch 2 owner reservation read | Owner list RPC | YES | YES | YES |
| Batch 3 booking lifecycle | Booking business | YES | YES | YES |
| Batch 4 resource blocks | Block business | YES | YES | YES |
| Batch 7 live runtime | NOW occupancy | YES | YES | YES |
| Batch 8 legacy isolation | Cluster tenant/venue columns | YES | YES | YES |

D4 Daily Play interval package was **hash-locked, not applied**. Canonical Daily Play capacity is `court_resource_reserve` / Adapter B → Head A, not D4 acquire.

`CERTIFIED_PACKAGE_HASHES_MATCH=YES` (see `tests/court-resource-batch9-architecture.test.js`).

## Identity / authority

```
SAME_PHYSICAL_ID_DOMAIN=PASS
PHYSICAL_ID_AUTHORITY=physicalCourtId (native UUID)
SAME_CAPACITY_AUTHORITY=PASS
CAPACITY_AUTHORITY=court_resource_reservations
CANONICAL_RUNTIME_LEGACY_AUTHORITY_FREE=YES
HEAD_A_CAPABILITY_COUNT=5
HEAD_A_V1_CHANGED=NO
HEAD_A_CONTRACT_SHA256=B3DC18602C5AEE63CD565622FFADD6388F3DFBA38A21056570F3BD7526BB5CE6
```

Fixture courts:

- `COURT_A1=11111111-1111-4111-8111-111111111111`
- `COURT_A2=22222222-2222-4222-8222-222222222222`
- `COURT_B1=33333333-3333-4333-8333-333333333333`

The same UUID is used by Booking, Daily Play, Internal, Official, Team, and Resource Block.

## Self-conflict

| Gate | Test ID | Result |
| --- | --- | --- |
| BOOKING_SELF_CONFLICT | B9-SC booking | PASS |
| DAILY_SELF_CONFLICT | B9-SC daily | PASS |
| INTERNAL_SELF_CONFLICT | B9-SC internal | PASS |
| OFFICIAL_SELF_CONFLICT | B9-SC official | PASS |
| TEAM_SELF_CONFLICT | B9-SC team | PASS |
| RESOURCE_BLOCK_SELF_CONFLICT | B9-SC maintenance | PASS |

Same `requestId` retry → `replay=true`, no duplicate active row.

## Cross-module matrix (15 pairs, both orders)

`CROSS_MODULE_PAIR_COUNT=15`  
`CROSS_MODULE_PAIR_PASS_COUNT=15`  
`BIDIRECTIONAL_PAIR_ORDERING=PASS`

| Pair | First→Second | Reverse |
| --- | --- | --- |
| BOOKING_DAILY | PASS | PASS |
| BOOKING_INTERNAL | PASS | PASS |
| BOOKING_OFFICIAL | PASS | PASS |
| BOOKING_TEAM | PASS | PASS |
| BOOKING_RESOURCE_BLOCK | PASS | PASS |
| DAILY_INTERNAL | PASS | PASS |
| DAILY_OFFICIAL | PASS | PASS |
| DAILY_TEAM | PASS | PASS |
| DAILY_RESOURCE_BLOCK | PASS | PASS |
| INTERNAL_OFFICIAL | PASS | PASS |
| INTERNAL_TEAM | PASS | PASS |
| INTERNAL_RESOURCE_BLOCK | PASS | PASS |
| OFFICIAL_TEAM | PASS | PASS |
| OFFICIAL_RESOURCE_BLOCK | PASS | PASS |
| TEAM_RESOURCE_BLOCK | PASS | PASS |

First owner succeeds. Second overlapping same-court owner fails closed (`FOREIGN_RESERVATION_CONFLICT`). No caller-specific exceptions.

Half-open `[)`: adjacent `18:00–19:00` / `19:00–20:00` allowed. Exact / partial / contains / contained overlap conflict. Non-overlap and different `physicalCourtId` allowed.

## Concurrency

```
REAL_DB_CONCURRENCY=PASS
CONCURRENCY_PAIR_COUNT=4
CONCURRENT_VALID_WINNER_COUNT=1
BOTH_SUCCESS_VIOLATION_COUNT=0
ZERO_WINNER_UNEXPECTED_COUNT=0
```

Test ID `B9-CONC`. Two real PostgreSQL sessions, `Promise.all`, no application serialization:

1. Booking vs Daily Play
2. Booking vs Resource Block (maintenance)
3. Internal vs Official
4. Team vs Resource Block (maintenance)

Database exclusion + `pg_advisory_xact_lock` inside `court_resource_reserve_core`.

## Multi-court atomicity

```
MULTI_COURT_ATOMICITY=PASS
MULTI_COURT_PARTIAL_RESERVATION_COUNT=0
```

Competition reserve `[A1, A2]` with A2 already held → whole command fails; A1 has zero rows for that owner. Booking remains single-court (not invented).

## Idempotency

```
IDEMPOTENCY=PASS
DUPLICATE_ACTIVE_CAPACITY_FROM_RETRY=0
REQUEST_ID_PAYLOAD_MISMATCH_FAILS_CLOSED=YES
```

Same `requestId` + different court payload → `IDEMPOTENCY_CONFLICT` for Booking and `court_resource_reserve`.

## Release

```
OWNER_SAFE_RELEASE=PASS
FOREIGN_OWNER_RELEASE_REJECTED=PASS (FOREIGN_OWNER_RELEASE_DENIED)
FOREIGN_TENANT_RELEASE_REJECTED=PASS (TENANT_FORBIDDEN)
REPEAT_RELEASE_SAFE=PASS
HISTORY_RETAINED=PASS
```

Covered: Booking cancel, Daily Play `court_resource_release`, Resource Block cancel, Competition via reservation RPC.

## Tenant / access

```
TENANT_ISOLATION=PASS
CLUB_ACCESS=PASS
DISABLED_ACCESS_REJECTED=PASS
LEGACY_BLOB_DOES_NOT_GRANT_ACCESS=PASS
```

Tenant A operator cannot list/reserve/release/update/begin-live against Tenant B. Club without `court_resource_club_operational_access` → `OUT_OF_SCOPE`. Disabled access → `OUT_OF_SCOPE`. Legacy mapping row does not grant capacity.

## Resource Block universal conflict

```
MAINTENANCE_UNIVERSAL_CONFLICT=PASS
OPERATIONAL_BLOCK_UNIVERSAL_CONFLICT=PASS
RESOURCE_BLOCK_UNIVERSAL_CONFLICT=PASS
```

Maintenance and Operational Block each conflict with Booking, Daily, Internal, Official, Team through `court_resource_reservations`.

## Daily Play

```
DAILY_CAPACITY_VIA_ADAPTER_B_HEAD_A=PASS
DAILY_LEASE_IS_PROJECTION=PASS
DAILY_PLAY_DOUBLE_RESERVATION_COUNT=0
D4_LEGACY_CAPACITY_CALLED_ON_CANONICAL_PATH=NO
D4_CERTIFIED_SQL_CHANGED=NO
```

Application routing: Adapter B → Head A only. Orchestrator records lease projection after Head A reserve. D4 acquire RPC is not imported and was not invoked.

## Competition

```
INTERNAL_CAPACITY_VIA_B_A=PASS
OFFICIAL_CAPACITY_VIA_B_A=PASS
TEAM_CAPACITY_VIA_B_A=PASS
CANONICAL_MODE_DIRECT_GATEWAY_BYPASS_COUNT=0
COMPETITION_DIRECT_RESERVATION_WRITE_COUNT=0
```

Mode Adapter B files do not import Gateway, blob storage, or reservation SQL. Head A provider is the only Gateway hop.

## Live runtime

```
LIVE_RUNTIME_CAPACITY_NON_AUTHORITY=PASS
BEGIN_SESSION_RESERVATION_DELTA=0
END_SESSION_RESERVATION_DELTA=0
CURRENT_STATE_CREATES_RESERVATION=NO
```

`reservationWriteCount=0` on begin/end. Future availability remains reservation-based. `UNAVAILABLE_NOW` does not insert a reservation row.

## Booking / Resource Block consistency

```
BOOKING_CREATE_ATOMICITY=PASS
BOOKING_FAILED_CREATE_ORPHAN_COUNT=0
BOOKING_FAILED_RESCHEDULE_PRESERVES_CAPACITY=PASS
BOOKING_FAILED_TRANSFER_PRESERVES_CAPACITY=PASS
BOOKING_CANCEL_CONSISTENT=PASS

RESOURCE_BLOCK_CREATE_ATOMICITY=PASS
RESOURCE_BLOCK_FAILED_CREATE_ORPHAN_COUNT=0
RESOURCE_BLOCK_FAILED_UPDATE_PRESERVES_CAPACITY=PASS
RESOURCE_BLOCK_FAILED_TRANSFER_PRESERVES_CAPACITY=PASS
RESOURCE_BLOCK_CANCEL_CONSISTENT=PASS
```

## Cluster tenant/venue semantics

```
COURT_CLUSTER_TENANT_VENUE_SEMANTICS=PASS
TENANT_ID_EXPLICIT=YES
VENUE_ID_EXPLICIT=YES
VENUE_AS_TENANT_ASSUMPTION_COUNT=0
UNRESOLVED_CLUSTER_SEMANTIC_COUNT=0
```

Inventory RPC filters cluster scope by `court_clusters.tenant_id`. Trap cluster (`venue_id=tenant-a`, `tenant_id=tenant-b`) is rejected for tenant A (`TENANT_MISMATCH`). Passing distinct `venue-a` as `tenantId` fail-closes.

**Deferred Staging-only / certified-SQL coupling:** Phase 3A `court_resource_identity_guard` still compares `physical_courts.tenant_id` to `court_clusters.venue_id` (package frozen). Operational clusters in this harness therefore keep `venue_id = tenant_id` so courts can insert. Batch 8 does not rewrite that trigger. Rewire requires a later Owner GO; it is not a Batch 9 source change.

## Legacy-free canonical graph

```
CANONICAL_PATH_LEGACY_AUTHORITY_HOPS=0
CLUB_DATA_V3_CANONICAL_AUTHORITY_COUNT=0
LOCALSTORAGE_CANONICAL_AUTHORITY_COUNT=0
LEGACY_MAPPING_CANONICAL_CALL_COUNT=0
```

Static proof: `tests/court-resource-batch9-architecture.test.js` B9-ARCH-04/05/06. Runtime DB paths used only canonical RPCs.

## Tests

| Suite | Result |
| --- | --- |
| `tests/court-resource-batch9-architecture.test.js` | PASS (7) |
| `tests/court-resource-batch9-adapter-routing.test.js` | PASS (5) |
| `tests/court-resource-batch9-cross-module-certification-real-postgres.test.js` | PASS (19) isolated embedded Postgres |
| Batch 1–8 court-resource regression subset | PASS (230) |
| `lint:no-new` | PASS |
| `npm run build` | PASS |
| `npm test` full unit | PASS (8158 tests, 8137 pass, 21 skipped opt-in, 0 fail) |

## Safety

```
SQL_CUTOVER_ENABLED=false
JS_CUTOVER_ENABLED=false
CANONICAL_BOOKING_LIFECYCLE_DEFAULT=false
CANONICAL_RESOURCE_BLOCKS_DEFAULT=false
CANONICAL_COMPETITION_COURT_ADAPTERS_DEFAULT=false
CANONICAL_COURT_LIVE_RUNTIME_DEFAULT=false
STAGING_SQL_APPLIED=NO
STAGING_MUTATIONS=0
PRODUCTION_SQL_APPLIED=NO
PRODUCTION_MUTATIONS=0
SOURCE_REMEDIATION_REQUIRED=NO
```

## Known deferred (not Batch 9 blockers)

1. Staging apply / dual cutover enable / real-browser Staging cutover.
2. Phase 3A identity guard still uses `court_clusters.venue_id` as court tenant scope (certified SQL unchanged).
3. Daily Play durable business aggregate (lease remains projection).
4. Production apply (Production lacks Phase 3A).
5. Booking has no multi-court RPC (not invented).

## Verdict

```
BATCH9_COMPLETE=YES
BATCH10_READY=NO
CROSS_MODULE_CAPACITY_CERTIFIED=YES
COURT_OPERATIONS_CORE_ARCHITECTURE_COMPLETE=YES
CANONICAL_RUNTIME_LEGACY_AUTHORITY_FREE=YES
WHOLE_SYSTEM_NATIVE_PHYSICAL_ID_END_TO_END=YES
```

Do not start Batch 10. Do not apply Staging SQL. Do not enable canonical flags. Do not merge PR #438.
