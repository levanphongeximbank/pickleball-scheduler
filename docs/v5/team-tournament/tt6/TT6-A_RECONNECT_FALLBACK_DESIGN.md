# TT-6A — Reconnect & Polling Fallback Design

**Date:** 2026-07-13  
**Status:** Design only — not implemented in TT-6A

---

## 1. Unified connection states

Merge Referee V5 states with TT-specific states:

| State | Meaning | UI label (VI) | Mutations | Realtime active | Polling active |
|-------|---------|---------------|-----------|-----------------|----------------|
| `connecting` | Initial subscribe | Đang kết nối | Block | Attempting | No |
| `connected` | Channel SUBSCRIBED | Đã kết nối | Allow* | Yes | No |
| `synced` | Post-reload stable | Đã đồng bộ | Allow* | Yes | No |
| `syncing` | Snapshot reload in flight | Đang đồng bộ | Block | Yes | No |
| `degraded` | Realtime down, poll active | Chế độ gián đoạn | Allow read; warn on write | No | Yes |
| `reconnecting` | Backoff retry | Đang kết nối lại | Block | Retrying | Yes |
| `disconnected` | Network/offline | Mất kết nối | Block | No | Yes |
| `unauthorized` | RLS/JWT/assignment fail | Không có quyền | Block | No | No** |
| `error` | Channel error | Lỗi đồng bộ | Block | No | Yes |
| `conflict` | Version/hash conflict | Có xung đột | Block until resolved | Paused | Optional |

\*Subject to existing mutation guards (version lock, TT-5 legacy lock, etc.)  
\*\*Poll only status banner — no data widening; user must re-auth

Referee V5 mapping: existing `REALTIME_CONNECTION` enum extended with `degraded` and `unauthorized` for TT service.

---

## 2. State machine (simplified)

```text
connecting → connected → synced
                ↓            ↑
            error/disconnected
                ↓
           reconnecting (backoff)
                ↓
     connected OR degraded (max retries)
                ↓
           unauthorized (auth/RLS fail — terminal until refresh)
```

---

## 3. Reconnect strategy

Reuse Referee V5 proven pattern (`realtimeSyncLogic.js`):

| Parameter | Default | Notes |
|-----------|---------|-------|
| Base delay | 1000ms | |
| Max delay | 30000ms | Exponential cap |
| Max attempts | unlimited | Tab lifetime |
| Jitter | optional TT-6B | Reduce thundering herd |

**On reconnect success:**

1. Set state → `connected`
2. **Mandatory** `refreshSnapshot(scope, 'reconnect')` — never trust missed events
3. Clear dedupe store for scope OR merge with eventId ledger (prefer full snapshot on reconnect)
4. Stop polling if realtime healthy

**On fixture change** (tournament switch, match change):

- Unsubscribe old channel completely
- Reset dedupe store for old scope
- Fresh `connecting` state

---

## 4. Polling fallback

### 4.1 When to enable

| Condition | Action |
|-----------|--------|
| `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED` | Enable poll + schedule reconnect |
| Realtime flag off | Poll-only mode (`degraded` permanent) |
| `unauthorized` | **No poll** — show auth error |
| Tab hidden | Pause poll timer (keep channel) |
| Tab visible again | Immediate `refreshSnapshot` + resume poll if degraded |

### 4.2 Intervals

| Context | Interval | Source |
|---------|----------|--------|
| TT degraded | 5000ms | `REPOSITORY_REALTIME_FALLBACK` |
| Referee V5 degraded | 8000ms | Existing V5 default |
| Unified service | Per-scope config; coordinator prevents duplicate timers |

### 4.3 Degraded mode UX rules

- Show **degraded banner** — never claim "realtime live"
- Badge color distinct from `synced`
- Optional last-updated timestamp from snapshot
- Writes allowed with warning if snapshot stale > 2× poll interval

---

## 5. Reload on reconnect (mandatory)

```text
reconnect success
  → refreshSnapshot({ scope, reason: 'reconnect' })
  → apply snapshot to page state (existing reload path)
  → rebuild local entityVersion map from snapshot
  → state = synced
```

**Never:** apply queued Realtime events without snapshot after gap > 0 versions.

---

## 6. Hidden tab behavior

| Component | Behavior |
|-----------|----------|
| TT polling coordinator | Pause interval |
| Realtime channel | Stay subscribed (Supabase handles WS) |
| On visibility visible | Immediate snapshot refresh |
| Referee V5 | Align TT-6B — pause poll only, same as TT page today |

---

## 7. Interaction with TT-5 outbox latency

Server propagation is async. Realtime (TT-6B) reduces latency vs 5s poll but:

- Consumer may lag V5 finalize by milliseconds–seconds
- Client must tolerate: V5 workspace shows finalized → TT portal updates on sub-match WAL event or degraded poll
- No double-apply: dedupe by `eventId` / inbox correlation

---

## 8. Unauthorized handling

Triggers:

- JWT expired
- Assignment revoked mid-session
- RLS policy denial (0 row delivery + access guard fail)

Actions:

1. State → `unauthorized`
2. Unsubscribe Realtime
3. Stop polling
4. Show re-login or "assignment revoked" banner
5. Do **not** fetch full tournament setup with elevated data

---

## 9. TT-6B implementation notes

| File (proposed) | Role |
|-----------------|------|
| `connectionStateMachine.js` | Transitions + guards |
| `pollingCoordinator.js` | Single timer per scope |
| `reconnectScheduler.js` | Backoff |
| Reuse `realtimeSyncLogic.js` | Shared pure functions where applicable |

---

## 10. Acceptance

| Criterion | Documented |
|-----------|------------|
| All required states | YES |
| Degraded ≠ realtime | YES |
| Reconnect → snapshot reload | YES |
| Poll stop when connected | YES |
| Unauthorized stops data fetch | YES |
