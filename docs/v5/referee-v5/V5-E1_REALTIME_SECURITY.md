# Referee V5-E1 — Realtime Security

**Trust boundary:** Database RLS + Edge JWT assignment verification (unchanged from V5-D).

---

## Authorization model

| Check | Mechanism |
|-------|-----------|
| Subscribe to match row | Supabase Realtime uses **authenticated JWT**; RLS `match_live_states_referee_select` applies |
| Assignment active | `referee_v5_current_user_has_assignment(tenant_id, tournament_id, match_id)` |
| Revoked / expired | Helper returns false → no SELECT → **no Realtime delivery** |
| Cross-tenant | RLS denies rows outside assignment tenant |
| Client-supplied tenant | **Not trusted** — row filter is DB `id`, authorization is RLS |

---

## Why postgres_changes + RLS

Supabase Realtime respects RLS for authenticated users. This satisfies assignment-level scope without broadcasting to all subscribers on a shared channel.

**Rejected for V5-E1:** Anonymous public channel with client-provided tenant ID.

---

## Payload minimization

Realtime row may contain `state_payload` in postgres WAL, but client code **extracts metadata only** (`state_version`, `last_event_sequence`, `match_id`, `tenant_id`).

Official state always loaded via Edge `get-state` after version check.

**Not sent over custom broadcast:** JWT, service-role key, full event history.

---

## Reconnect

- Session re-validated on Supabase reconnect (JWT refresh)
- Resubscribe on fixture / token change
- No offline command replay in V5-E1

---

## Production

**NOT ENABLED** — staging only until owner approval.
