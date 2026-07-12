# V5-D.1 — Architecture Correction

**Status:** COMPLETE (draft code + SQL)  
**Date:** 2026-07-12

---

## Problem (V5-D review)

V5-D described Postgres RPC performing lock, then Edge Function committing in a separate request. That is **not transactional** — row locks do not survive across HTTP/RPC boundaries.

## Corrected flow

```text
Client (browser)
  → Edge Function (JWT verified)
      1. Derive actor from verified token
      2. Load state (read-only)
      3. dispatchMatchCommand() [V5-B engine]
      4. Build request_hash + next_state
      5. ONE call to referee_v5_commit_match_transition (service role)
  → Atomic PostgreSQL transaction
      SELECT ... FOR UPDATE
      idempotency check
      INSERT match_events
      UPDATE match_live_states
      INSERT match_sync_mutations
      audit
      COMMIT
```

Finalize follows the same split:

```text
Edge → verify completed → referee_v5_commit_match_finalization (single txn)
```

## Code mapping

| Layer | Module |
|-------|--------|
| Edge read/compute | `RefereeV5EdgeCommandHandler` |
| Atomic commit | `RefereeV5AtomicCommitService` |
| Browser client | `refereeV5EdgeClient.js` |
| Internal RPC client | `refereeV5InternalRpcService.js` (service role) |
| Public read RPC | `refereeV5GetMatchState` only |

## V5-D RPC changes

| RPC | V5-D | V5-D.1 |
|-----|------|--------|
| `referee_v5_apply_match_command` | authenticated shell | **REVOKED** from authenticated |
| `referee_v5_commit_match_transition` | n/a | **service_role ONLY** |
| `referee_v5_finalize_match_result` | authenticated shell | **REVOKED** |
| `referee_v5_commit_match_finalization` | n/a | **service_role ONLY** |

## Migration order

1. `PHASE_V5A_REFEREE_FOUNDATION.sql`
2. `PHASE_V5D_REFEREE_PERSISTENCE.sql`
3. `PHASE_V5D1_REFEREE_HARDENING.sql`

Recommended: single clean staging apply — never partially applied in production.
