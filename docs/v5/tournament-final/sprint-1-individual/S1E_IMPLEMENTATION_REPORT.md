# S1-E — Schedule Publish + Minimum Rest (Implementation Report)

**Sprint:** Tournament V5 Sprint 1  
**Batch:** S1-E  
**Date:** 2026-07-14  
**Status:** ✅ Implemented — **STOP FOR OWNER REVIEW**

---

## Objective

Close Sprint-1 gaps **S1-GAP-502**, **S1-GAP-501**, **S1-GAP-503** only (individual tournament).

---

## Deliverables

| Gap | Fix |
|-----|-----|
| **S1-GAP-502** | New individual `publishScheduleEngine.js` — draft → lock → publish with immutable snapshot on `settings.schedule.*`. Reopen (Owner) + force republish (Owner/Super Admin). Demo team page replaced with real individual loader. |
| **S1-GAP-501** | `scheduleEngine.js` enforces `minRestMinutes` per participant with auto-adjust; impossible window → `ok: false`. `restTimeEngine.js` for conflict/rest validation + organizer warnings. |
| **S1-GAP-503** | `ScheduleBuilderPanel` match ops: change court/time with soft rest warnings. |

---

## Schedule lifecycle

```
draft ──lock──► locked ──publish──► published (immutable snapshot)
   ▲                                    │
   └──────── reopen / forceRepublish ───┘
              (owner / Super Admin only)
```

**Prerequisite:** draw must be **published** before lock/publish schedule.

**Audit actions:** `schedule_created`, `schedule_locked`, `schedule_published`, `schedule_reopened`, `schedule_force_publish`

**Blob schema:** `settings.schedule.{ status, publishedAt, publishedBy, lockedAt, lockedBy, snapshot, auditLog, createdAt, createdBy, minRestMinutes }`

---

## Court allocation (S1-E)

- Respect unlocked courts only  
- Priority sort (`priority` desc)  
- Session windows (`morning` / `afternoon` / `evening` or custom `sessions[]`)  
- Court `availableSessions` validation  

---

## Files changed

| File | Change |
|------|--------|
| `src/tournament/engines/publishScheduleEngine.js` | **NEW** — individual publish/lock/reopen/force |
| `src/features/individual-tournament/engines/restTimeEngine.js` | **NEW** — min rest + conflict checks |
| `src/features/tournament-engine/engines/scheduleEngine.js` | Min rest, sessions, court priority |
| `src/features/tournament-engine/validation/tournamentValidation.js` | Sessions accept as time source |
| `src/features/tournament-engine/constants/defaults.js` | `minRestMinutes: 15` |
| `src/features/tournament-engine/services/tournamentEngineAdapter.js` | Wire minRest + court sessions |
| `src/features/tournament-engine/hooks/useTournamentEngine.js` | Schedule publish API + regenerate guards |
| `src/components/tournament/SchedulePublishControls.jsx` | **NEW** |
| `src/components/tournament/ScheduleBuilderPanel.jsx` | **NEW** — builder + ops + warnings |
| `src/components/tournament/PlayerSchedulePanel.jsx` | **NEW** — player published view |
| `src/pages/tournament/TournamentPublishSchedulePage.jsx` | Real individual loader (no team demo) |
| `src/pages/tournament/engine/tabs/EngineScheduleTab.jsx` | Builder + publish controls |
| `src/pages/tournament/IndividualRegistrationPage.jsx` | Player schedule panel |
| `OfficialTournamentSetup.jsx` / `InternalTournamentSetup.jsx` | Link to schedule publish |
| `individual-tournament/index.js` | Export rest helpers |
| `tests/individual-tournament-schedule.test.js` | **NEW** — T-S1-E01–E03 |
| `docs/.../S1E_IMPLEMENTATION_REPORT.md` | This report |
| `docs/.../S1_INDIVIDUAL_GAP_MATRIX.md` | Gaps closed |
| `docs/v5/qa-evidence/.../S1E_SCHEDULE_PUBLISH_REPORT.json` | QA evidence |

## Untouched (per rules)

- Team `publishScheduleEngine.js`  
- S1-A draw engine behavior (consumed as prerequisite only)  
- S1-B / S1-C / S1-D cores  
- Rating V5 calculation  
- Team tournament  
- Deploy / merge  

---

## Automated test results

```bash
node --test \
  tests/individual-tournament-schedule.test.js \
  tests/individual-tournament-draw-publish.test.js \
  tests/individual-tournament-registration.test.js \
  tests/individual-tournament-eligibility.test.js \
  tests/individual-tournament-seed-standings.test.js \
  tests/tournament-engine.test.js \
  tests/tournament-regression.test.js
# 55/55 PASS (incl. T-S1-E01–E03)
```

---

## Manual QA checklist (owner)

| # | Step | Expected |
|---|------|----------|
| M1 | Draw published → Công bố lịch page → Tạo lịch | Slots + courts assigned; min rest honored |
| M2 | Set minRest high + short day | Generation fails with clear error |
| M3 | Khóa → Công bố | `publishedAt` + immutable snapshot |
| M4 | Try regenerate after publish | Blocked |
| M5 | Force republish (owner) | Allowed; audit `schedule_force_publish` |
| M6 | BTC đổi sân/giờ trước publish gây thiếu nghỉ | Soft warning shown |
| M7 | Player registration page after publish | Sees time / court / opponent |

---

## Out of scope (not implemented)

- S1-F referee / propagation  
- S1-GAP-504 postpone UI  
- S1-GAP-505 CC-09 as default runtime  
- Team tournament schedule changes  
- Production deploy / merge  

---

## Owner review gate

**Verdict requested:** Approve S1-E → proceed S1-F (referee & result propagation), or request changes.
