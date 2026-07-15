# REFEREE V5-R1B — Edge Function & Realtime Audit

**Phase:** R1-B  
**Date:** 2026-07-13

---

## 1. Edge Function pipeline

**Entry:** `supabase/functions/referee-v5-match/` → `edgeHttpHandler.js` → `RefereeV5EdgeCommandHandler.js`  
**Bundle:** `supabase/functions/_shared/refereeV5Server.mjs`

### `apply-command` flow

| Step | Location | Mô tả |
|------|----------|-------|
| HTTP / CORS | `edgeHttpHandler.js` | POST, Bearer JWT |
| Token verify | `refereeV5TrustBoundary.js` | `deriveUserIdFromVerifiedToken` |
| Assignment | `RefereeV5SupabaseRepository.findAssignmentByUserAndMatch` | `referee_assignments` |
| Actor | `resolveTrustedActor` | userId + assignment |
| Validate command | `validateMatchCommandPayload` | Type, forbidden keys, MLP reject |
| Idempotency | `findIdempotency` | `match_sync_mutations` |
| Load state | `getLiveState`, `getEvents`, `getInitialState` | Snapshot + history |
| **Engine** | `dispatchMatchCommand` → `applyMatchEvent` | **Không ghi DB** |
| Commit | `RefereeV5RpcAtomicCommitService.commitMatchTransition` | Atomic RPC |
| Auth commit | RPC SQL + `canWriteMatch` | Re-check assignment |

### `get-state`
Assignment check → return full `state_payload` (includes `scoringFormat`).

### `finalize`
`verifySnapshotMatchesReplay` → `match_result_revisions` → lock → `match_integration_outbox`.

### Feature flags
**Không có trên Edge.** Flags chỉ client (`flags.js`: `VITE_REFEREE_V5_ENABLED`, realtime mode).

---

## 2. Điểm chọn engine SIDE_OUT vs RALLY

### Hiện tại (đúng layer)
```
RefereeV5EdgeCommandHandler
  → dispatchMatchCommand (no engine choice)
    → matchStateEngine.applyMatchEvent
      → applyRallyWin
        → state.scoringFormat === "rally" ? rallyScoringEngine : sideOutScoringEngine
```

### Nên chọn engine ở đâu
| Layer | Vai trò |
|-------|---------|
| **Provision / initialize** | Set `scoringFormat` once |
| **`matchStateEngine` / future ScoringStrategy** | Branch scoring rules |
| Edge / persistence | **Không** chọn engine |
| Per-event payload | **Không** chứa format (anti-tamper) |

### Backend validation impact khi thêm Rally
- `validateCommandPayload`: không đổi (cùng commands).
- `validateStateSchema`: có thể cần rally-specific rules (serverNumber optional).
- `verifySnapshotMatchesReplay`: **phải** test rally path.
- Finalize hash: phải khớp rally engine output.

---

## 3. Realtime audit

### Kiến trúc
```
postgres_changes on match_live_states
  → extractRealtimeNotification (version, sequence, status only)
  → shouldReloadFromNotification
  → reloadOfficialState() via Edge get-state
```

### Câu trả lời

| Câu hỏi | Trả lời |
|---------|---------|
| Realtime có scoring logic? | **Không** — chỉ version notification |
| Client reload? | **Có** — full state từ Edge |
| Phụ thuộc Side-Out? | **Không** |
| Rally cần đổi contract? | **Không** |

### Files
| File | Vai trò |
|------|---------|
| `refereeV5RealtimeChannel.js` | Channel subscribe |
| `realtimeSyncLogic.js` | Version compare, reload decision |
| `useRefereeRealtimeSync.js` | Hook + polling fallback 8s |
| `realtimeConnectionStates.js` | Notification extract |

### Tests
`referee-v5-e1-realtime.test.js` — 10 tests, version-only, no scoring.

---

## 4. Kết luận

| | |
|--|--|
| Engine selection point | `matchStateEngine.applyRallyWin` (future: ScoringStrategy registry) |
| Edge changes for rally | Minimal — replay test coverage needed |
| Realtime | **REALTIME REUSABLE AS-IS** |

**Code changes:** DOCUMENTATION ONLY
