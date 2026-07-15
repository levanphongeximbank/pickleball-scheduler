# REFEREE V5-R — Owner Decisions (Approved)

**Phase:** Owner Review — REFEREE V5-R  
**Date:** 2026-07-13  
**Status:** APPROVED  
**Supersedes:** Open questions in `V5-R1A_RECOMMENDED_FIRST_VARIANT.md` §5

---

## 1. Rule set chính thức

| Decision | Value |
|----------|-------|
| **Approved rule set** | USA Pickleball 2026 Provisional Rally Scoring |
| **Profile ID** | `USAP_2026_PROVISIONAL_RALLY` |
| **Prototype** | `rallyScoringEngine.js` hiện tại **không** là chuẩn chính thức — thay thế trong R2 |

---

## 2. Điểm thắng mặc định

| Field | Value |
|-------|-------|
| `pointsToWin` (default) | **11** |
| `winBy` | **2** |
| Configurable future | **15**, **21** — kiến trúc phải hỗ trợ, không hard-code toàn hệ thống |
| R2 scope | Chỉ triển khai + test đầy đủ **11 / win by 2** |

---

## 3. Match format / best-of

- Trận kết thúc ngay khi một bên đạt đủ số game cần thắng.
- Ví dụ best-of-3: thắng 2 game → trận kết thúc **2-0** hoặc **2-1** — không bắt buộc đánh game còn lại.
- Team Tournament chỉ nhận **official finalized result**.

---

## 4. Scope R2

| In scope R2 | Out of scope R2 |
|-------------|-----------------|
| **Doubles Rally** only | Singles Rally |
| USAP 2026 profile | DreamBreaker |
| | MLP variant |
| | Freeze scoring |

---

## 5. DreamBreaker

- **Loại khỏi R2.**
- Format riêng — phase tương lai.
- **Không** là `scoringVariant` của Rally profile đầu tiên.

---

## 6. Freeze scoring

| Field | Value |
|-------|-------|
| `freezeRule` | **NONE** |
| R2 engine | Không thêm điều kiện freeze |
| Tương lai | Rules profile hoặc phase riêng nếu cần |

---

## 7. Kiến trúc bắt buộc

- **Scoring Strategy + Registry** (ADR-003, R1-C design).
- **Shared Match Core:** lifecycle, persistence, undo/replay, realtime, finalize, official result.
- **Side-Out:** giữ nguyên hành vi hiện tại — không regression.
- **Rally:** strategy riêng — không rải `if/else` theo `scoringSystem`.
- **Không** silent fallback Rally → Side-Out.
- DreamBreaker / MLP: format/strategy riêng tương lai.

---

## 8. Match format profile (first supported)

```json
{
  "scoringSystem": "RALLY",
  "scoringVariant": "USAP_2026_PROVISIONAL_RALLY",
  "pointsToWin": 11,
  "winBy": 2,
  "freezeRule": "NONE",
  "serverNumberRule": "NONE",
  "supportedMatchType": "DOUBLES"
}
```

---

## 9. Legacy compatibility

| Case | Behavior |
|------|----------|
| Match Side-Out cũ thiếu `scoringSystem` | Replay theo **legacy rule** rõ ràng (`SIDE_OUT` + variant default) |
| Match mới | **Bắt buộc** `scoringSystem` + `scoringVariant` |
| Silent Rally fallback | **Cấm** — thiếu/sai format → lỗi, không mặc định Side-Out |

---

## 10. Database / migration

- **Migration decision: DEFERRED** (R1-C ghi nhận; quyết định sau audit dữ liệu thật).
- **Chưa apply SQL** trong phase này.
- R1-B: mở rộng JSON state có thể đủ; không kết luận vĩnh viễn không cần migration.

---

## 11. Team Tournament

- Team Tournament **chọn** scoring format (discipline / sub-match).
- Referee V5 **thực thi** format đã chọn.
- TT chỉ nhận **official result** — không tự tính Rally.
- Standings không phụ thuộc loại scoring.
- Format **khóa** sau khi match bắt đầu (immutable).

---

## 12. Sign-off

| Item | Owner |
|------|-------|
| Rule set USAP 2026 | APPROVED |
| Default 11 / win by 2 | APPROVED |
| Doubles-only R2 | APPROVED |
| DreamBreaker deferred | APPROVED |
| Freeze NONE | APPROVED |
| Strategy + Registry | APPROVED |
| Migration deferred | APPROVED |
| TT integration model | APPROVED |

**Next phase:** R1-C documentation → R2 implementation (sau GO riêng).
