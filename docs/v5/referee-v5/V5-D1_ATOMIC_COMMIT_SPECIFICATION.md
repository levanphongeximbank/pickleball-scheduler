# V5-D.1 — Atomic Commit Specification

**RPC:** `referee_v5_commit_match_transition`  
**Access:** `service_role` ONLY

---

## Input (from Edge Function)

| Parameter | Source |
|-----------|--------|
| `p_actor_id` | Verified JWT (never client body) |
| `p_next_state` | V5-B engine output |
| `p_expected_state_version` | Optimistic lock |
| `p_expected_event_sequence` | Sequence lock |
| `p_request_hash` | Canonical hash of command intent |
| `p_idempotency_key` | Client retry key |

## Transaction steps (single COMMIT)

1. `SELECT match_live_states ... FOR UPDATE`
2. Assignment validation (actor + tenant + match)
3. Idempotency lookup — return cached if hash matches
4. `IDEMPOTENCY_KEY_REUSE_MISMATCH` if hash differs
5. Version / sequence check
6. `stateSchemaVersion = 1` validation
7. Structural invariants (court ends, version +1, sequence +1)
8. `INSERT match_events`
9. `UPDATE match_live_states` (payload, hash, version)
10. `INSERT match_sync_mutations`
11. Return committed version/sequence/hash

On any failure: **ROLLBACK** entire transaction.

## Finalize RPC

**RPC:** `referee_v5_commit_match_finalization`

Same transaction wraps:

- Result revision insert
- Live state lock
- Outbox records
- Finalize idempotency record

## JS mirror (pre-staging tests)

`RefereeV5AtomicCommitService.commitMatchTransition()` uses `InMemoryMatchRepository.atomicTransaction()` with row lock held for all writes.
