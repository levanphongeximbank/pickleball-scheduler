# COMMS-05 Persistence Design

## Ownership

Communication Foundation owns `public.communication_*` tables and adapters under
`src/features/communication/persistence/`.

Does **not** own: Identity profiles, Club membership, Player display, tenant lifecycle,
Notification delivery, Competition realtime channels.

## Canonical locations

| Artifact | Path |
|----------|------|
| Forward migration | `docs/supabase-communication-comms05.sql` |
| Rollback notes | `docs/supabase-communication-comms05-rollback.sql` |
| Adapters | `src/features/communication/persistence/supabase/` |
| Realtime foundation | `src/features/communication/persistence/realtime/` |
| Event/outbox boundary | `src/features/communication/persistence/outbox/` |

## Client contract

- Injected Supabase-compatible client only (no env / no singleton in adapters).
- Trusted backend / service-role expected while `CLIENT_RLS_POLICY = DEFERRED_FAIL_CLOSED`.
- Application authorization remains on COMMS ports (membership readers, policies).

## Ordering

- Server-allocated `position bigint` per conversation (`communication_allocate_message_position`).
- Pagination by position cursor — not offset.
- Client timestamps are never the sole ordering authority.

## Idempotency

- `message_id` primary key (insert-once).
- Optional `client_idempotency_key` unique per conversation.
- Direct `pair_key`, pending request, channel key, pin uniqueness constraints.

## Activation

See `activationGates.js` and `docs/communication-foundation/comms-05/05_PERSISTENCE_AND_REALTIME.md`.
