# S2-F — Referee ops readiness (TT-5)

**Sprint:** Tournament V5 Sprint 2  
**Batch:** S2-F  
**Date:** 2026-07-14  
**Status:** ✅ Implemented — **STOP FOR OWNER REVIEW**  
**Deploy:** ❌ · **Merge:** ❌ · **Production SQL:** ❌ blocked

---

## Objective

Close / waive **S2-GAP-050** for **staging ops readiness**:
- Checklist evaluate tables / RPCs / flags / evidence
- Document legacy deprecation steps
- **Không** apply Production SQL

Soft: **S2-GAP-051 / 052** deferred (legacy fallback + correction UX polish).

---

## Deliverables

| Area | Artifact |
|------|----------|
| Engine | `teamRefereeOpsReadinessEngine.js` |
| Service | `getTeamRefereeOpsReadinessReport` |
| UI | Tab **Lịch đối đầu** → panel sẵn sàng trọng tài |
| Evidence | `docs/v5/qa-evidence/sprint-2-team/S2F_TT5_OPS_READINESS_EVIDENCE.json` |
| Legacy steps | `S2F_LEGACY_DEPRECATION_STEPS.md` |
| Tests | T-S2-F01–F06 |

---

## Verdicts

| Environment | Verdict |
|-------------|---------|
| Staging (TT-5 evidence) | **READY** |
| Production | **PRODUCTION_NOT_APPLIED** (Owner GO riêng) |

MCP live SQL inventory: **UNAVAILABLE** (client registration error sau auth) — dùng inventory dẫn xuất từ `TT5_FINAL_REPORT`.

---

## Tests

```bash
node --test tests/team-tournament-referee-ops-readiness.test.js
# T-S2-F01–F06 PASS
```

---

**Verdict requested:** Approve S2-F → next **S2-G** (realtime gates), hoặc đóng Sprint 2.
