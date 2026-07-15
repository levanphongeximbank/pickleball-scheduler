# REFEREE V5-R1B — Persistence & Event Model Audit

**Phase:** R1-B  
**Date:** 2026-07-13

---

## 1. Event / command contract

### Command types (client → server)
`MATCH_EVENT_TYPE`: `START_MATCH`, `TEAM_A_WON_RALLY`, `TEAM_B_WON_RALLY`, `SWITCH_ENDS`, `UNDO_LAST_EVENT`, `PAUSE_MATCH`, `RESUME_MATCH`, `DECLARE_FORFEIT`, timeouts.

**Scoring-agnostic:** Cùng command `TEAM_*_WON_RALLY` cho side-out và rally.

### Persisted event record
| Field | Nội dung |
|-------|----------|
| `command_type` | Intent (không có scoring system) |
| `command_payload` | Client payload — **cấm** ghi đè score/serve (`validateCommandPayload.js`) |
| `generated_events` | Audit: `POINT_AWARDED`, `SIDE_OUT`, `SERVE_CHANGED`, `RALLY_WON`, … |
| `state_version_before/after` | Optimistic locking |
| `event_sequence` | Monotonic |

`generated_events` **không** dùng cho replay — chỉ audit/timeline.

---

## 2. State snapshot

### Canonical state (`state_payload` JSON)
| Field | Scoring relevance |
|-------|-------------------|
| `scoringFormat` | `"side_out"` \| `"rally"` — **engine selector** |
| `pointsToWin`, `winBy`, `maximumScore` | Game end |
| `matchType` | singles / doubles |
| `serverNumber` | Side-out doubles; rally should ignore |
| `teams`, `servingPlayerId`, `receivingPlayerId` | Shared |
| `version`, `lastEventSequence`, `status` | Lifecycle |

### SQL columns (`PHASE_V5A_REFEREE_FOUNDATION.sql`)
- `scoring_system`: `'side_out' | 'rally'`
- `scoring_format`: jsonb blob
- `state_payload`: canonical V5 state

**Gap:** `rallyVariant`, `sideSwitchAt`, `freezeAt` không persist trong state skeleton mặc định.

### Schema version
- `STATE_SCHEMA_VERSION = 1` — strict, không upgrade path.

---

## 3. Idempotency / locking / commit

| Mechanism | File |
|-----------|------|
| Idempotency key | `match_sync_mutations` |
| Version conflict | `validateEventPreconditions` → `VERSION_CONFLICT` |
| Sequence gap | `SEQUENCE_GAP` |
| Atomic commit | `RefereeV5RpcAtomicCommitService` → RPC `referee_v5_commit_match_transition` |
| Replay hash | `canonicalStateHash.js` + `verifySnapshotMatchesReplay` |
| Finalize | `processFinalize` → revision + lock + outbox |
| Append-only | Events không sửa/xóa |

---

## 4. Câu trả lời bắt buộc

### 1. Event model có lưu scoring system không?
**Không** — từng event không lưu. Chỉ match-level state / SQL column.

### 2. Initial state có lưu scoring format không?
**Có** — `state_payload.scoringFormat` + `scoring_system` column. Provision TT-5B ghi qua `team_tournament_build_v5_state_shell`.

### 3. Replay có biết engine nào cần dùng không?
**Có** — `rebuildMatchState` / `verifySnapshotMatchesReplay` gọi `applyMatchEvent` → `applyRallyWin` đọc `state.scoringFormat` mỗi bước.

### 4. Event cũ Side-Out có replay được sau khi thêm Rally không?
**Có**, nếu `initialState.scoringFormat === "side_out"` giữ nguyên. Command vocabulary không đổi.

### 5. Có cần schema version mới không?
**Không bắt buộc** cho rally cơ bản nếu mở rộng JSON state. Có thể thêm fields optional (`ruleSetId`, `sideSwitchAt`) trong v1.

### 6. Có cần migration không?
**Không** cho rally mới nếu provision set đúng format. **Có rủi ro logic** nếu `scoring_system` column ≠ `state_payload.scoringFormat` (không sync).

### 7. Có nguy cơ replay Rally bằng Side-Out engine không?
**Có — P0 risk:**
- `scoringFormat` missing → default `side_out`
- Column `scoring_system = rally` nhưng JSON thiếu field → engine side-out
- Đổi format giữa chừng (không được phép) → replay sai

**Mitigation hiện có:** `verifySnapshotMatchesReplay` trước finalize — hash mismatch → block.

---

## 5. File persistence chính

| File | Vai trò |
|------|---------|
| `RefereeV5PersistenceService.js` | Orchestration |
| `RefereeV5EdgeCommandHandler.js` | apply-command, finalize, replay verify |
| `RefereeV5SupabaseRepository.js` | DB read/write |
| `validateCommandPayload.js` | Command guard |
| `validateStateSchema.js` | State shape + MLP reject |
| `validatePersistedState.js` | Hydration guard |
| `matchStateSerializer.js` | Serialize/deserialize |
| `canonicalStateHash.js` | Replay integrity |
| `RefereeV5RpcAtomicCommitService.js` | Transaction commit |
| `auditLog.js` | Audit actions |

---

## 6. Kết luận

| | |
|--|--|
| Event compatibility | ✅ Commands shared |
| State schema impact | Mở rộng JSON — không cần migration DB |
| Migration required | **NO** (logic mapping TT→V5 cần fix) |
| Replay safety | Phụ thuộc `scoringFormat` trong initial state |

**Code changes:** DOCUMENTATION ONLY
