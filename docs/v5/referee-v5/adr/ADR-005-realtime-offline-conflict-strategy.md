# ADR-005: Realtime and Offline Conflict Strategy

**Status:** Proposed (V5-A)  
**Date:** 2026-07-12

## Context

Current referee token path uses 4s polling. Offline score is blocked (`offlineCapabilityMatrix.js`). V5 needs multi-device consistency without duplicate events.

## Decision

### Realtime

- Primary device: write via RPC.
- Subscribers: Supabase Realtime on `match_live_states` filtered by `match_id`.
- Payload: full snapshot + `version` (not incremental score deltas).

### Offline (configurable, default conservative)

| Mode | Behavior |
|------|----------|
| `offline_scoring_disabled` | Default — same as legacy BLOCK |
| `offline_scoring_enabled` | Queue events locally; sync on reconnect |

Each queued mutation includes:

```text
client_mutation_id, idempotency_key, expected_version, eventType, payload
```

### Conflict

If `expected_version != current_version`:

- RPC returns `409 CONFLICT` + current snapshot.
- Client shows conflict UI; **no auto-merge** of rally events.

## Consequences

- Finalize remains **online-only** until proven safe.
- Legacy polling can coexist for read-only viewers during migration.

## Alternatives rejected

- **Last-write-wins on score:** current classic model — rejected for V5.
