# Runtime and persistence architecture

## Ports (smallest viable)

| Port | Responsibility | V5 table |
|---|---|---|
| assignmentRepository | query/upsert assignment | `referee_assignments` |
| matchStateRepository | CORE-15 snapshot + expectedVersion | `match_live_states` (+ `state_payload`) |
| scoringEventLedger | CORE-16 events + idempotencyKey/commandId | `match_events` + `match_sync_mutations` |
| resultRevisionRepository | accepted history / supersession | `match_result_revisions` |

Omitted as separate ports:

- audit sink → reuse CORE-13 `refereeAuditSinkPort` at organizer wiring
- extra command ledger → folded into `match_sync_mutations`

## In-memory runtime

`createInMemoryRefereeOperationsStore`

- classification: `TEST_DOUBLE_ONLY`
- default E2E-04 facade dependency
- not production persistence

## Production-capable composition

`createCanonicalRefereePersistenceRuntime(options)`

- injectable
- writes CORE payloads into V5 table vocabulary
- does **not** call Referee V5 scoring/lifecycle/result engines
- properties: tenant scoped, assignment scoped, `auth.uid`, `expectedVersion`, idempotency, append-only events, immutable accepted history via supersession, fail-closed stale write, replay-safe duplicate idempotency

`wiredToProductionRuntime=false` on E2E-04 facade: default remains test double. Do not flip until a durable repository (Supabase/RPC) is injected as the default composition.

## Do not create

`referee_assignments_v2`, `match_events_v2`, another result table.

## RPC/Edge

Reuse V5 transaction shell later (auth, row lock, version, idempotency, append). Do not reuse V5-B `dispatchMatchCommand` as scoring authority for CE adapters.
