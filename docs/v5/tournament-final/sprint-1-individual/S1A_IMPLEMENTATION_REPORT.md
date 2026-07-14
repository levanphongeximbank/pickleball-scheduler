# S1-A — Engine Wiring + Draw Publish (Implementation Report)

**Sprint:** Tournament V5 Sprint 1  
**Batch:** S1-A  
**Date:** 2026-07-14  
**Status:** ✅ Implemented — **STOP FOR OWNER REVIEW**

---

## Objective

Close Sprint-1 gaps **S1-GAP-308**, **S1-GAP-303**, **S1-GAP-305**, **S1-GAP-304** only.

---

## Deliverables

| Gap | Fix |
|-----|-----|
| **S1-GAP-308** | `useTournamentEngine.js` wired to real orchestrator (`runSeedEngine`, `runDrawEngine`, `runScheduleEngine`, `runCourtAssignmentEngine`, `runRankingEngine`, `runFullTournamentPlan`). Removed `runPlatformEngineWorkflow` stub. |
| **S1-GAP-303** | New `src/tournament/engines/publishDrawEngine.js` — draft → lock → publish lifecycle with immutable snapshot on blob (`settings.draw.*`). |
| **S1-GAP-305** | Regenerate guards via `canRegenerateDraw()`; `forceRedrawDraw()` for owner/Super Admin after publish. |
| **S1-GAP-304** | Actor + before/after in `engineRunLog.js`, `workflowHistory.js`, and `settings.draw.auditLog[]` + identity `writeAuditLog`. |

---

## Draw lifecycle

```
draft ──lock──► locked ──publish──► published (immutable snapshot)
   ▲                                    │
   └──────── reopen / forceRedraw ──────┘
              (owner / Super Admin only)
```

**Audit actions:** `draw_created`, `draw_locked`, `draw_published`, `draw_reopened`, `draw_force_redraw`

**Blob schema:** `settings.draw.{ status, publishedAt, publishedBy, lockedAt, lockedBy, snapshot, auditLog, createdAt, createdBy }`

---

## Files changed

| File | Change |
|------|--------|
| `src/tournament/engines/publishDrawEngine.js` | **NEW** — publish/lock/reopen/forceRedraw engine |
| `src/components/tournament/DrawPublishControls.jsx` | **NEW** — shared UI controls |
| `src/features/tournament-engine/hooks/useTournamentEngine.js` | Real engine wiring + draw publish API |
| `src/features/tournament-engine/services/engineRunLog.js` | Actor, before/after fields |
| `src/features/tournament-engine/hooks/workflowHistory.js` | Actor, before/after fields |
| `src/features/tournament-engine/orchestrator/tournamentEngine.js` | Pass audit fields to run log |
| `src/pages/tournament/engine/tabs/EngineDrawTab.jsx` | Draw publish UI |
| `src/pages/tournament/TournamentEnginePage.jsx` | Removed platform stub preview |
| `src/pages/tournament/OfficialTournamentSetup.jsx` | Draw guards + publish controls |
| `src/pages/tournament/InternalTournamentSetup.jsx` | Draw guards + publish controls |
| `tests/individual-tournament-draw-publish.test.js` | **NEW** — T-S1-A01–A04 |

---

## Automated test results

```bash
node --test tests/individual-tournament-draw-publish.test.js tests/tournament-engine.test.js
# 22/22 PASS

node --test tests/tournament-regression.test.js
# 6/6 PASS
```

---

## Manual QA checklist (owner)

| # | Step | Expected |
|---|------|----------|
| M1 | Engine 4.0 → Seed → Draw | Real participant/group data (not 6-name stub) |
| M2 | Draw tab → Khóa bốc thăm | Status = locked |
| M3 | Công bố bốc thăm | `publishedAt` set; snapshot saved |
| M4 | Try Random lại / regenerate | Blocked with message |
| M5 | Force redraw (owner) | Allowed; audit entry in workflow + draw auditLog |
| M6 | Internal setup → same flow | Parity with official open draw |

---

## Out of scope (not implemented)

- S1-B registration lifecycle
- S1-D Rating V5 seed edits
- S1-E schedule publish
- Team tournament changes
- Production deploy / merge

---

## Owner review gate

**Verdict requested:** Approve S1-A → proceed S1-B, or request changes.
