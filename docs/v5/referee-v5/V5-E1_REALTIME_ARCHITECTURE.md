# Referee V5-E1 — Realtime Architecture

**Status:** Implemented (staging)  
**Related:** [V5-E specification](./V5-E_REALTIME_OFFLINE_SPECIFICATION.md), [ADR-005](./adr/ADR-005-realtime-offline-conflict-strategy.md)

---

## Mechanism

```text
Database transaction commits (RPC via Edge)
  → UPDATE match_live_states (state_version++)
  → Supabase Realtime postgres_changes (RLS-filtered)
  → Client receives version notification ONLY
  → Client reloads official state via Edge get-state
  → UI renders official state
```

**Realtime mechanism:** Supabase Realtime `postgres_changes` on `public.match_live_states`, filtered by `id=eq.{matchStateId}`.

**Channel name:** `referee-v5:match:{matchId}`

**Not used:** Broadcast full state payload into domain engine; raw `match_events` subscription.

---

## Source of truth

| Layer | Role |
|-------|------|
| `match_live_states` | Authoritative snapshot |
| `match_events` | Append-only audit |
| Realtime notification | Hint to reload — not authoritative |

Client rules (enforced in `realtimeSyncLogic.js` + `useRefereeRealtimeSync`):

1. Compare `state_version` from notification vs local.
2. If `notificationVersion <= localVersion` → ignore (duplicate / out-of-order).
3. If newer → call `reloadOfficialState()` (Edge `get-state`).
4. Never apply `state_payload` from Realtime row directly.

---

## Components

| File | Responsibility |
|------|----------------|
| `realtime/refereeV5RealtimeChannel.js` | Subscribe / reconnect / poll fallback |
| `realtime/realtimeSyncLogic.js` | Version gating, backoff, mutation disable rules |
| `hooks/useRefereeRealtimeSync.js` | React lifecycle, reload orchestration |
| `hooks/useRefereeRemoteMatchController.js` | Wires sync into remote controller |

---

## Connection states

| State | UI (VI) |
|-------|---------|
| CONNECTING | Đang kết nối |
| CONNECTED | Đã kết nối |
| RECONNECTING | Đang kết nối lại |
| DISCONNECTED | Mất kết nối |
| SYNCING | Đang đồng bộ |
| SYNCED | Đã đồng bộ |
| CONFLICT | Có xung đột |
| ERROR | Lỗi đồng bộ |

---

## Polling fallback

When Realtime is disconnected (`DISCONNECTED`, `ERROR`, `RECONNECTING`):

- Poll official reload every **8 seconds**
- Stop polling when subscription is `SUBSCRIBED`
- No poll while Realtime healthy

---

## Feature flag

```text
VITE_REFEREE_V5_REALTIME_ENABLED=true   (default when remote mode)
```

---

## SQL (staging)

`docs/v5/referee-v5/PHASE_V5E1_REALTIME_SYNC.sql` — adds `match_live_states` to `supabase_realtime` publication.

Apply: `node scripts/apply-phase-v5e1-staging.mjs`

---

## Out of scope (V5-E1)

- Offline mutation queue (V5-E2)
- Director dashboard subscription
- Public live scoreboard
- MLP / Rating V5 integration
