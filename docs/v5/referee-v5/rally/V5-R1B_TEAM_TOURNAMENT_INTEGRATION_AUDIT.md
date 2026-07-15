# REFEREE V5-R1B — Team Tournament Integration Audit

**Phase:** R1-B  
**Date:** 2026-07-13  
**Context:** TT-5 đã merge; audit bridge TT ↔ Referee V5.

---

## 1. Kiến trúc tích hợp

```
Team Tournament sub-match
  → team_tournament_provision_referee_match (TT5-B)
  → match_live_states (V5)
  → team_sub_match_referee_links (bridge)
  → Referee V5 Edge (live scoring)
  → finalize → match_result_revisions
  → match_integration_outbox
  → team_tournament_consume_referee_v5_outbox (TT5-C)
  → sub-match score / standings
```

**Không import trực tiếp** `team-tournament` → `referee-v5` modules. Tích hợp qua SQL/RPC + route `/referee/match/{id}`.

---

## 2. Câu trả lời bắt buộc

### 1. Team Tournament có hard-code Side-Out không?
**Mặc định side-out**, không hard-code tuyệt đối:
- Discipline model: `scoringFormat.scoringSystem` default `SIDE_OUT`.
- MLP preset: `RALLY` + target 21.
- **V5 provision SQL default `side_out`** nếu JSON thiếu key.

### 2. Có field `scoringSystem` chưa?
**Có** — Team Tournament: `discipline.scoringFormat.scoringSystem` (`"side_out"` | `"rally"`).

### 3. Có field `scoringVariant` chưa?
**TT:** không có `scoringVariant` riêng; có `freezeAt`, `sideSwitchAt`, `rotationPoints` trong discipline.
**V5:** `rallyVariant` (`basic` | `mlp`) — MLP **rejected**.

### 4. Có thể chọn Rally theo tournament / discipline / sub-match?
| Cấp | Khả năng |
|-----|----------|
| Tournament / discipline | ✅ Cấu hình `scoringSystem: rally` |
| Sub-match | Kế thừa discipline |
| V5 live state | ⚠️ **Mapping gap** — xem §3 |

### 5. Result contract có phụ thuộc Side-Out không?
**Không** — `mapRefereeV5ResultToSubMatch` trả `{ teamA, teamB, games: [] }`. Chỉ cần điểm cuối + winner.

### 6. Standings có cần biết loại scoring?
**Không** — standings dùng win/loss/points từ sub-match result, không phân biệt scoring system.

### 7. Nguy cơ cộng điểm đội sai khi thêm Rally?
| Rủi ro | Mức |
|--------|-----|
| Legacy portal + V5 cùng ghi | **Thấp** — legacy lock khi bridge active |
| Duplicate outbox | **Thấp** — idempotency inbox |
| **Provision sai format** (rally discipline → V5 side-out) | **Cao — P0** |
| Hai engine rally khác nhau (TT validation vs V5 live) | **Trung bình — P1** |

---

## 3. Mapping gap (P0)

**TT discipline JSON:**
```json
{ "scoringSystem": "rally", "targetScore": 21, "winBy": 2 }
```

**V5 provision** (`TT5-B_PROVISION_RPC.sql` `team_tournament_build_v5_state_shell`):
```sql
v_format := coalesce(p_scoring_format->>'scoringFormat', 'side_out');
v_points := coalesce((p_scoring_format->>'pointsToWin')::int, 11);
```

**Không map** `scoringSystem` → `scoringFormat`, `targetScore` → `pointsToWin`.

**Hệ quả:** Discipline rally có thể provision V5 state với `side_out` + `pointsToWin: 11`.

---

## 4. Bridge table & flows

### `team_sub_match_referee_links` (TT5-B_BRIDGE_SCHEMA.sql)
| Field | Mục đích |
|-------|----------|
| `referee_match_id` | = external sub-match id |
| `status` | pending → provisioned → active → finalized |
| `last_result_revision_id` | TT5-C propagation |
| `snapshot` | Lineup + discipline at provision |

### Live state creation
`team_tournament_provision_referee_match` → INSERT `match_live_states` nếu chưa có.

### Official result path
V5 finalize → revision → outbox `STANDINGS_RECALC_REQUESTED` → consumer → sub-match update → standings cache.

### Legacy lock
`team_tournament_sub_match_score_ops` → `blockCode` khi V5 linked:
- `referee_v5_linked_legacy_write_blocked`
- `referee_v5_match_active`
- `referee_v5_result_finalized`

`TeamRefereePortal.jsx`: `canSaveLegacyDraft` + link tới V5 workspace.

### Dreambreaker
Explicitly **ngoài phạm vi** TT-5 V5 bridge — panel riêng trong portal.

---

## 5. Module liên quan

| Path | Vai trò |
|------|---------|
| `team-tournament/engines/teamRefereeV5BridgeEngine.js` | Client bridge helpers |
| `team-tournament/engines/rallyScoringEngine.js` | **Validation cuối** (khác V5 engine) |
| `pages/tournament/TeamRefereePortal.jsx` | Legacy portal + V5 lock UI |
| `docs/.../TT5-B_PROVISION_RPC.sql` | Provision |
| `docs/.../TT5-C_RESULT_PROPAGATION.md` | Result flow |

---

## 6. Kết luận

| | |
|--|--|
| Existing format field | TT: `scoringSystem`; V5: `scoringFormat` |
| Bridge impact | Provision mapping **must fix** before rally production |
| Result impact | Minimal — score numbers only |
| Standings impact | None |

**Không sửa Team Tournament trong R1-B.**

**Code changes:** DOCUMENTATION ONLY
