# Runtime gap matrix vs PR #431 ports

END A contract `competition.referee.adapter.v1` `1.0.0` is unchanged.

| Port | Live table | Gap | Action |
|---|---|---|---|
| assignmentRepository | referee_assignments | none | persist CORE-13 result |
| matchStateRepository | match_live_states.state_payload | envelope `stateSchemaVersion=1` required by existing RPC | wrap CORE-15 snapshot |
| scoringEventLedger | match_events + match_sync_mutations | none | append + idempotency ledger |
| resultRevisionRepository | match_result_revisions | lineageStatus is app mapping over live status + supersedes_revision | insert-only official accepted |

Idempotency: **no extra port**. Folded into scoringEventLedger / `match_sync_mutations`. Durable unique `(match_state_id, idempotency_key)`. Same key + same request_hash = replay. Same key + different hash = fail-closed.

## Required properties

| Property | Live | Local runtime |
|---|---|---|
| tenant scoped | YES | YES |
| assignment scoped | YES | YES |
| auth.uid scoped | YES | YES |
| expectedVersion | state_version | YES, fail-closed |
| idempotencyKey / commandId | YES | caller or content-stable hash; no Date.now |
| append-only events | trigger | YES |
| atomic state/event commit | V5 transition RPC | schema-faithful replica |
| official result revision | YES | CORE-17 ACCEPTED only |
| accepted-result immutability | insert new revision | YES |
| correction via supersession | supersedes_revision | YES |
| replay safety | YES | YES |
| fail-closed stale writes | MATCH_STATE_CONFLICT | STALE_WRITE |

LIVE_DB_COMPATIBLE_WITH_END_A=YES

Smallest schema delta: **none**. Ensure-live-state is service-role INSERT of existing `match_live_states`. Correction is INSERT of existing `match_result_revisions`. No destructive migration.
