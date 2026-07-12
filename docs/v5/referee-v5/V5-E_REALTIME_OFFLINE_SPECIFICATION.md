# Referee V5-E — Realtime & Offline Specification

**Status:** Design (V5-A)  
**Related ADR:** [ADR-005](./adr/ADR-005-realtime-offline-conflict-strategy.md)

---

## 1. Realtime architecture

### 1.1 Channels

| Subscriber | Channel filter | Payload |
|------------|----------------|---------|
| Referee primary device | `match_live_states.id=eq.{id}` | Full snapshot |
| Director dashboard | `tournament_id=eq.{id}` | All match states in tournament |
| Live scoreboard (public) | Read-only view — **owner decision** | Redacted snapshot |
| Team captain | Denied write; optional read if permitted | — |

### 1.2 Event flow

```text
Referee device → RPC apply_event → DB update match_live_states.version
  → Realtime broadcast → Director / secondary devices refresh
```

**Not** broadcast raw `match_events` to clients (snapshot sufficient for UI).

### 1.3 Latency targets

| Metric | Target |
|--------|--------|
| Referee tap → own UI update | < 100ms optimistic |
| Referee tap → other devices | < 500ms p95 |
| Reconnect full sync | < 2s |

### 1.4 Current vs V5

| Aspect | Legacy | V5 |
|--------|--------|-----|
| Referee token sync | Poll 4s (`matchLiveSync.js` L596) | Realtime + poll fallback |
| Director | Realtime `tournament_match_live` | `match_live_states` |
| Duplicate events | RPC row lock only | idempotency_key |

---

## 2. Multi-device roles

| Device | Role | Write |
|--------|------|-------|
| Primary referee phone | `is_primary=true` | Yes |
| Scorekeeper tablet | `SCOREKEEPER` assignment | Configurable |
| Director | View + override | Override RPC only |
| Live score TV | Read-only | No |

Secondary device **must not** apply events if primary holds lock (optional `device_session` lease — V5-F).

---

## 3. Mutation contract

Every write:

```json
{
  "matchStateId": "...",
  "eventType": "RALLY_WON",
  "payload": { "winningTeamId": "team-a" },
  "expectedVersion": 17,
  "clientMutationId": "uuid-v4",
  "idempotencyKey": "matchId:clientMutationId"
}
```

### Server responses

| Code | Meaning | Client action |
|------|---------|---------------|
| 200 | Applied | Replace local state |
| 200 duplicate | Idempotent replay | Same |
| 409 | Version conflict | Fetch snapshot, show merge UI |
| 403 | Not assigned | Block UI |
| 423 | Match locked | Read-only |

---

## 4. Reconnect

```text
1. Fetch referee_v5_get_match_state
2. Compare version with local
3. If local queue non-empty:
     a. Retry mutations in order with expectedVersion
     b. Stop on first 409 → conflict UI
4. Resume Realtime subscription
```

---

## 5. Offline modes

### 5.1 State machine (client)

```text
ONLINE_SYNCED
ONLINE_PENDING (queue draining)
OFFLINE_CACHED (read snapshot cache)
OFFLINE_MUTATING (queue accepting — if enabled)
CONFLICT_HALTED
```

### 5.2 Default policy (align with legacy)

| Action | Offline |
|--------|---------|
| View cached state | ✅ READ_ONLY |
| Apply rally event | ❌ BLOCK (default) |
| Referee note | ✅ (existing) |
| Finalize | ❌ BLOCK |

### 5.3 Optional enabled offline (owner decision)

When `referee_v5_offline_scoring_enabled`:

- Queue events in IndexedDB table `referee_v5_pending_mutations`
- UI banner: **CHƯA ĐỒNG BỘ (N sự kiện)**
- Never show "confirmed" until server ACK
- On sync: sequential replay with idempotency

### 5.4 Conflict UI

```text
Server đã cập nhật từ thiết bị khác.
[Tải trạng thái mới] [Liên hệ BTC]
```

No silent merge of rally lists.

---

## 6. Tenant isolation

Realtime filter **must** include:

```text
tenant_id = auth.tenant_id
```

RLS policies (V5-E phase) enforce same on `match_live_states` and `match_events`.

---

## 7. Subscription cleanup

On unmount / route leave:

```javascript
supabase.removeChannel(channel);
```

Prevent cross-match leakage (audit legacy `subscribeTournamentMatchLive` pattern in `matchLiveSync.js`).

---

## 8. Current state

| Item | Status |
|------|--------|
| V5 Realtime | **NOT IMPLEMENTED** |
| V5 offline queue | **NOT IMPLEMENTED** |
| Legacy offline score | **BLOCKED** (verified `offlineCapabilityMatrix.js`) |

---

*Specification only.*
