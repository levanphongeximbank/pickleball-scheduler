# S2-C — Substitution Before Lock / Publish

**Sprint:** Tournament V5 Sprint 2  
**Batch:** S2-C  
**Date:** 2026-07-14  
**Status:** ✅ Implemented — **STOP FOR OWNER REVIEW**  
**Deploy:** ❌ · **Merge:** ❌

---

## Objective

Close **S2-GAP-020**: BTC / đội trưởng **thay VĐV trên roster** khi đội hình **chưa khóa / chưa công bố**.  
Giữa trận / sau công bố → vẫn dùng TT-3 override (ngoài S2-C).

Owner lock: thay người **trước khóa / trước công bố**.

---

## Deliverables

| Area | Fix |
|------|-----|
| Gate | Chặn nếu lineup của đội = locked / published / immutable |
| Engine | `applyRosterSubstitution` — out→in, cập nhật lineup nháp/đã nộp, log |
| Permissions | `TEAM_SUBSTITUTION_REQUEST` (captain) · `APPROVE` / manage (BTC) |
| Service | `substituteTeamPlayer` + cloud remove/assign/captain |
| UI | `TeamSubstitutionPanel` trên tab Đội (BTC) + Captain Portal |
| Audit | `TEAM_AUDIT_ACTIONS.TEAM_SUBSTITUTION` |

---

## Files

| File | Change |
|------|--------|
| `engines/substitutionEngine.js` | **NEW** |
| `TeamSubstitutionPanel.jsx` | **NEW** |
| `teamTournamentService.js` | substitute APIs |
| `teamPermissionEngine.js` | request/approve helpers |
| `TeamRosterPanel.jsx` / `TeamPortal.jsx` | wire UI |
| `tests/team-tournament-substitution.test.js` | T-S2-C01–C06 |

---

## Automated tests

```bash
node --test tests/team-tournament-substitution.test.js
# T-S2-C01–C06 PASS
```

---

## Owner review gate

**Verdict requested:** Approve S2-C → proceed **S2-D** (vòng bảng → knock-out), or request changes.

**How to try:**  
1. BTC: giải đồng đội → tab **Đội** → **Thay người** (khi chưa khóa đội hình).  
2. Captain: `/team-portal/:id` → panel thay người.  
3. Sau khi BTC **khóa / công bố** đội hình → đổi người bị chặn (đúng thiết kế).
