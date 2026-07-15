# S2 — Team Tournament: Definition of Done

**Sprint:** Tournament V5 Sprint 2  
**Date:** 2026-07-14  
**Phase:** ✅ **CLOSED** — exit criteria met for **staging pilot**  
**Canonical report:** `S2_TEAM_FINAL_REPORT.md`

---

## DoD principles (frozen)

1. **Team only** — no Individual / Daily / Rating V5 rewrites.  
2. **Respect TT-5 ownership** — Referee V5 = live/official; Team = lineup / aggregate / standings.  
3. **Extend, don’t fork** — lineup SM, standings, RPC, realtime stay canonical.  
4. **Staging first** — no Production deploy without separate Owner Production GO.  
5. Production SQL / realtime flag = **ops GO**, not feature-batch default.

---

## Sprint exit (staging pilot) — RESULT

| Criterion | Result |
|-----------|--------|
| S2-B clone existing teams | ✅ PASS |
| S2-C pre-lock substitution | ✅ PASS |
| S2-D group → KO | ✅ PASS |
| S2-E standings / tie-break harden | ✅ PASS |
| S2-H awards + close | ✅ PASS |
| S2-F TT-5 staging readiness checklist | ✅ PASS (Prod apply deferred) |
| S2-G realtime Staging/Preview gates; Prod OFF | ✅ PASS |
| Unit suites T-S2-B…G | ✅ PASS |
| No Production deploy from S2 close | ✅ HONORED |
| Deferred items registered | ✅ `S2_DEFERRED_ITEMS_REGISTER.md` |

**Overall:** Staging pilot DoD **MET**. Production readiness **NOT YET ASSESSED**.
