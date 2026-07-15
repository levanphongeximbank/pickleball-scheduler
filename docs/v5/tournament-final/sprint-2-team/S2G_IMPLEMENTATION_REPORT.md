# S2-G — Realtime enable gates (TT-6)

**Sprint:** Tournament V5 Sprint 2  
**Batch:** S2-G  
**Date:** 2026-07-14  
**Status:** ✅ Implemented — **STOP FOR OWNER REVIEW**  
**Deploy:** ❌ · **Merge:** ❌ · **Production realtime flag:** OFF (Owner-gated)

---

## Objective

Close **S2-GAP-060** for staged enable posture:
1. Flag matrix Staging → Preview (Production blocked)
2. Reconnect / poll fallback contract gates
3. Captain isolation under publication (evidence TT-6C)
4. Multi-device smoke rows (TT-6D evidence index)

---

## Deliverables

| Area | Artifact |
|------|----------|
| Engine | `teamRealtimeEnableGatesEngine.js` |
| Flags helper | `readTeamTournamentRealtimeEnv` |
| Service | `getTeamRealtimeEnableGatesReport` |
| UI | Panel trên tab **Lịch đối đầu** |
| Evidence | `docs/v5/qa-evidence/sprint-2-team/S2G_REALTIME_ENABLE_GATES_EVIDENCE.json` |
| Tests | T-S2-G01–G06 |

---

## Policy

| Stage | `VITE_TT_REALTIME_ENABLED` |
|-------|----------------------------|
| Staging / Preview | Có thể `true` |
| Production | **Giữ `false`** đến Owner Production GO |

Khi realtime mất kết nối: trạng thái DEGRADED/RECONNECTING/DISCONNECTED → poll fallback (4s / 8s / 15s hidden).

---

## Tests

```bash
node --test tests/team-tournament-realtime-enable-gates.test.js
# T-S2-G01–G06 PASS
```

---

**Verdict requested:** Approve S2-G → **đóng Sprint 2** (feature + ops staging), hoặc Owner GO Production riêng (TT-5 SQL / TT-6 flag).
