# Version, idempotency, atomicity

Command flow:

```
adapter/client intent
  → E2E-04
  → CORE-15 / CORE-16
  → expectedVersion check
  → atomic durable commit:
       append match_event
       update match_live_state
       record match_sync_mutations response
```

## Rules

- Stale expectedVersion → fail-closed. No event, no version bump.
- Same idempotencyKey + same request hash → deterministic replay.
- Same idempotencyKey + conflicting request → fail-closed.
- Production keys: caller `commandId` / `idempotencyKey`, or infrastructure content-stable hash. Never `Date.now()`.
- `match_events` append-only.
- Successful commit increments `state_version` / `version` exactly once and `last_event_sequence` exactly once.
- Fresh GET reconstructs the same canonical snapshot from `state_payload`. No localStorage authority.

Realtime-ready: one authoritative `match_live_states` row per match after commit. UI is out of scope.
