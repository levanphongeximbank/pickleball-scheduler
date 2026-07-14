# S2-D — Group Stage → Team Knockout

**Sprint:** Tournament V5 Sprint 2  
**Batch:** S2-D  
**Date:** 2026-07-14  
**Status:** ✅ Implemented — **STOP FOR OWNER REVIEW**  
**Deploy:** ❌ · **Merge:** ❌

---

## Objective

Close **S2-GAP-030**: sau vòng bảng, BTC tạo **nhánh knockout** (group → KO only). Không hỗ trợ KO-direct trong S2-D.

---

## Deliverables

| Area | Fix |
|------|-----|
| Engine | `teamKnockoutEngine.js` — qualify, pair seeds, generate KO matchups, advance winner |
| Service | `generateTeamKnockoutBracket` + `previewTeamKnockoutGate` |
| UI | TeamTournamentSetup matchups bar → **Tạo nhánh knockout** (qualifiers 1\|2) |
| Result hook | `computeMatchupResult` → `maybeAdvanceKnockoutAfterResult` |
| Tests | T-S2-D01–D06 |

---

## Behavior

1. Yêu cầu đã **chia bảng** (`groups` ≥ 1 với ≥ 2 đội).
2. Lấy `qualifiersPerGroup` (1 hoặc 2) theo BXH từng bảng.
3. Seed: tất cả hạng 1 rồi hạng 2… → cặp vòng 1: 1 vs cuối, 2 vs kế cuối (cross-group khi 2 bảng × 2).
4. **Giữ** matchup vòng tròn bảng; chỉ thay / thêm matchup `stage=knockout`.
5. Bye (số đội ≠ lũy thừa 2) → auto-complete + advance vào slot kế.
6. Khi trận KO completed có `winnerTeamId` → đổ vào `nextMatchupId` / `nextSlot`.

---

## Files

| File | Change |
|------|--------|
| `engines/teamKnockoutEngine.js` | EXISTING (verify) |
| `services/teamTournamentService.js` | `generateTeamKnockoutBracket` |
| `TeamTournamentSetup.jsx` | Dialog + action bar button |
| `tests/team-tournament-knockout.test.js` | **NEW** T-S2-D01–D06 |

Also restored (disk loss): S2-B catalog engine, S2-C substitution engine + panel + service APIs.

---

## Automated tests

```bash
node --test tests/team-tournament-existing-team-clone.test.js tests/team-tournament-substitution.test.js tests/team-tournament-knockout.test.js
# T-S2-B01–B07, T-S2-C01–C06, T-S2-D01–D06 PASS
```

---

## Owner review gate

**Verdict requested:** Approve S2-D → proceed **S2-E** (standings / tie-break harden), or request changes.

**How to try:**  
1. Giải đồng đội → chia bảng + tạo RR theo bảng.  
2. Tab **Lịch đối đầu** → **Tạo nhánh knockout** → chọn 1 hoặc 2 đội/bảng.  
3. Xác nhận → thấy matchup `knockout` + message số đội vượt qua.  
4. Nhập kết quả KO → đội thắng đổ vào trận kế.
