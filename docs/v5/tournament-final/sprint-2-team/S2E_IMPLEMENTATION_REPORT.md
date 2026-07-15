# S2-E — Standings & Tie-break Harden

**Sprint:** Tournament V5 Sprint 2  
**Batch:** S2-E  
**Date:** 2026-07-14  
**Status:** ✅ Implemented — **STOP FOR OWNER REVIEW**  
**Deploy:** ❌ · **Merge:** ❌

---

## Objective

Close **S2-GAP-040 / S2-GAP-041**:
- Multi-way mini-table khi ≥3 đội hòa
- H2H 2 đội
- Khóa thứ tự tie-break sau tạo knockout (hoặc BTC khóa tay)
- UI cấu hình thứ tự + BXH theo bảng

---

## Deliverables

| Area | Fix |
|------|-----|
| Ranking | `rankStandingsRows` + `buildMiniTableStats` |
| Default order | wins → subMatchDiff → pointsScored → headToHead → manual |
| Freeze | auto khi generate KO; `freezeTeamTiebreakOrder` |
| Group BXH | `getGroupStandingsTables` trên tab BXH |
| UI | `TeamTiebreakConfigPanel` |

---

## Automated tests

```bash
node --test tests/team-tournament-standings-tiebreak.test.js
# T-S2-E01–E06 PASS
```

---

## Owner review gate

**Verdict requested:** Approve S2-E → next **S2-F** (referee ops readiness) hoặc **S2-H** (awards/close) theo ưu tiên Owner.

**How to try:** Tab **BXH** → chỉnh thứ tự xử hòa → tạo knockout để thấy khóa.
