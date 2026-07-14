# S2-H — Awards + Closing (+ TT9-LIM residual)

**Sprint:** Tournament V5 Sprint 2  
**Batch:** S2-H  
**Date:** 2026-07-14  
**Status:** ✅ Implemented — **STOP FOR OWNER REVIEW**  
**Deploy:** ❌ · **Merge:** ❌

---

## Objective

Close **S2-GAP-080**: BTC gán / xuất podium và **đóng giải đồng đội** (khóa kết quả, đóng băng BXH, tóm tắt).  
**S2-GAP-070 (TT9-LIM-01):** document residual — không đổi runtime mobile orientation trong batch này.

Owner lock: port pattern Individual S1-G **không** sửa Individual runtime.

---

## Deliverables

| Area | Fix |
|------|-----|
| Awards engine | KO final → vô địch/á quân; không KO → BXH; fair-play thủ công; JSON/CSV export |
| Closing engine | `closeTeamTournament` — auto awards, lock matchups, freeze standings, `settings.closed` |
| Service | `updateTeamAwardsConfig`, `assignTeamAward`, `autoAssignTeamAwards`, `closeTeamTournamentForClub` |
| Guards | Closed → chặn đổi awards / tạo KO / thay người |
| UI | Tab **Trao giải** — `TeamAwardsClosePanel.jsx` |
| TT9-LIM-01 | Residual documented (orientation remount freeze @900px) — **DEFERRED** |

---

## Tests

```bash
node --test tests/team-tournament-awards-closing.test.js
# T-S2-H01–H06 PASS
```

---

## How to try (BTC)

1. Mở giải đồng đội → tab **Trao giải**  
2. **Gán tự động** (hoặc chọn tay) → **Xuất JSON/CSV**  
3. **Đóng giải ngay** → BXH/kết quả khóa; không gán lại được  

---

## Out of scope

S2-F/G ops · mid-match sub · KO-direct · Production deploy · Individual code edits · TT9-LIM-01 code fix

---

**Verdict requested:** Approve S2-H → next **S2-F** (trọng tài ops) hoặc **S2-G** (realtime gates), hoặc đóng Sprint 2 feature track.
