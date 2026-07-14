# S1-F — Referee Assignment + Match Result Propagation (Implementation Report)

**Sprint:** Tournament V5 Sprint 1  
**Batch:** S1-F  
**Date:** 2026-07-14  
**Status:** ✅ Implemented — **STOP FOR OWNER REVIEW**

---

## Objective

Close Sprint-1 gaps **S1-GAP-061, 063, 067, 069, 100** (and soft **064** walkover/result types; **062** classic path documented) for Individual Tournament only.

---

## Deliverables

| Gap | Fix |
|-----|-----|
| **S1-GAP-061** | Replaced team demo `TournamentRefereeAssignPage` with real individual loader + `RefereeAssignPanel` (manual / auto / reassign). |
| **S1-GAP-100** | Blob `settings.refereeAssignments[matchId]` + `assertAssignmentScope` (token/roster). |
| **S1-GAP-063** | `resultPropagationEngine.propagateMatchResult` → event matches + live standings + KO sync. |
| **S1-GAP-069** | Durable `settings.resultPropagation.processedCommandIds` for finalize idempotency. |
| **S1-GAP-067** | `resultCorrectionEngine` request → approve/reject → recalculate downstream. |
| **S1-GAP-064** | Result types: completed / walkover / retirement / injury / DQ / forfeit + monitor UI. |
| **S1-GAP-062** | Pilot uses classic `/referee/:token` + Referee portal tab; Referee V5 individual deferred (no team V5 changes). |

---

## Lifecycle

```
assign referee ──► start match ──► submit score ──► confirm/finalize
                                                         │
                                                         ▼
                                              propagate (once / commandId)
                                                         │
                              ┌──────────────────────────┼──────────────────────────┐
                              ▼                          ▼                          ▼
                         standings                  bracket advance            lock match
                              │
                              ▼
                    correction request → approve → unlock → re-propagate → recompute
```

**Audit actions:** `referee_assigned`, `referee_changed`, `referee_revoked`, `referee_auto_assigned`, `result_submitted`, `result_confirmed`, `result_corrected`

**Blob schema:**
- `settings.refereeRoster` (existing) + `settings.refereeAssignments`
- `settings.matchResults`
- `settings.resultPropagation.{ auditLog, processedCommandIds }`
- `settings.resultCorrections[]`
- `settings.liveStandings[eventId]`

---

## Files changed

| File | Change |
|------|--------|
| `src/features/individual-tournament/engines/refereeAssignEngine.js` | **NEW** — assign/auto/reassign/conflict/scope |
| `src/features/individual-tournament/engines/matchResultEngine.js` | **NEW** — result types, submit/confirm/finalize, lock |
| `src/features/individual-tournament/engines/resultPropagationEngine.js` | **NEW** — propagate + recalculate |
| `src/features/individual-tournament/engines/resultCorrectionEngine.js` | **NEW** — correction workflow |
| `src/features/individual-tournament/index.js` | Export S1-F APIs |
| `src/components/tournament/RefereeAssignPanel.jsx` | **NEW** |
| `src/components/tournament/MatchResultMonitorPanel.jsx` | **NEW** |
| `src/components/tournament/ResultCorrectionPanel.jsx` | **NEW** |
| `src/components/tournament/IndividualRefereePortalPanel.jsx` | **NEW** |
| `src/components/tournament/PlayerLiveResultsPanel.jsx` | **NEW** |
| `src/pages/tournament/TournamentRefereeAssignPage.jsx` | Real individual multi-tab page |
| `src/pages/tournament/IndividualRegistrationPage.jsx` | Player live results panel |
| `tests/individual-tournament-referee-result.test.js` | **NEW** — T-S1-F01–F05 |
| Docs + QA evidence | This report + JSON |

## Untouched (per rules)

- S1-A…S1-E engines (draw/schedule/registration/eligibility/seed cores)
- Team tournament / TT5 SQL RPCs
- Rating V5 calculation modules
- Deploy / merge

---

## Automated test results

```bash
node --test \
  tests/individual-tournament-referee-result.test.js \
  tests/individual-tournament-schedule.test.js \
  tests/individual-tournament-draw-publish.test.js \
  tests/individual-tournament-registration.test.js \
  tests/individual-tournament-eligibility.test.js \
  tests/individual-tournament-seed-standings.test.js \
  tests/tournament-engine.test.js \
  tests/tournament-regression.test.js
# 64/64 PASS (incl. T-S1-F01–F05)
```

---

## Manual QA checklist (owner)

| # | Step | Expected |
|---|------|----------|
| M1 | Chọn giải cá nhân → tab Phân công TT → thêm trọng tài | Roster lưu blob |
| M2 | Gán thủ công 1 trận + Tự động phân công | Assign + conflict chip nếu trùng giờ |
| M3 | Đổi trọng tài | Audit `referee_changed` |
| M4 | Tab Giám sát → Xác nhận kết quả tỷ số | Match locked; standings live cập nhật |
| M5 | Walkover / chấn thương / DQ | Status forfeit + resultType |
| M6 | Tab Cổng trọng tài → gửi tỷ số → xác nhận | Propagate once |
| M7 | Tab Sửa kết quả → duyệt | Score mới + audit `result_corrected` |
| M8 | VĐV registration page | Thấy kết quả live / BXH |
| M9 | Duplicate finalize same commandId | Idempotent — không double-count |

---

## Out of scope (not implemented)

- S1-G awards / withdrawal UI polish (beyond result types)
- Server SQL `individual_match_assignments` / TT5 outbox RPCs (blob pilot parity with S1-A…E)
- Referee V5 individual rally UI
- Production deploy / merge

---

## Owner review gate

**Verdict requested:** Approve S1-F → proceed S1-G (results ops / awards), or request changes.
