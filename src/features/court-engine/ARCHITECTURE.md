# Court Engine v4.0 — Sprint 6

## Mục tiêu

Hệ thống điều hành sân hoàn chỉnh: check-in → queue → auto assignment → timer → chuyển sân → trọng tài → activity log.

**Không thay thế** Director Mode (`/tournament/director/:id`). Court Engine là route riêng `/court-engine`.

## Kiến trúc

```
src/features/court-engine/
  constants/     statuses, playModes
  models/        courtSession
  storage/       localStorage per club
  engines/       autoCourtAssignmentEngine (generateCourtAssignments, confirmAssignments)
  services/      checkIn, queue, timer, transfer, referee, eventLog, courtState, courtEngineService
  guards/        RBAC hooks (DIRECTOR_USE / SCHEDULING_RUN)
  hooks/         useCourtEngine
```

## Data model (localStorage)

Key: `pickleball-court-engine-v1::{clubId}`

Session blob gồm:
- `checkIns[]` — PlayerCheckIn
- `queue[]` — PlayQueue
- `assignments[]` — CourtAssignment
- `refereeAssignments[]` — RefereeAssignment
- `transferLogs[]` — CourtTransferLog
- `events[]` — CourtEngineEventLog
- `courtStates{}` — runtime sân (status, locked, maintenance, currentMatchId)
- `config` — play mode, timer, repeat rules

Active session: `pickleball-court-engine-active-v1::{clubId}`

## Court availability & `courtStates`

Sân **bận** (không được auto-assign) khi:

| Nguồn | Trạng thái bận |
|-------|----------------|
| `courtStates[courtId].status` | `assigned`, `playing`, `paused`, `overrun` |
| `assignments[]` (fallback) | `status` tương ứng trên assignment active |

`courtStateService.js`:
- `collectBusyCourtIds(courtStates, activeAssignments)` — hợp nhất sân bận từ cả hai nguồn
- `patchCourtState()` — cập nhật immutable `courtStates`

**Đồng bộ `courtStates`:**

| Thao tác | Service | Runtime status |
|----------|---------|----------------|
| Confirm assignment | `confirmAssignments()` | `assigned` |
| Start match | `startMatchTimer()` | `playing` |
| Pause | `pauseMatchTimer()` | `paused` |
| Resume | `resumeMatchTimer()` | `playing` |
| End match | `endMatchTimer()` | `empty` |

Fallback `activeAssignments` bảo vệ session localStorage cũ khi `courtStates` chưa kịp sync.

## Auto assignment

- Preview: `generateCourtAssignments()` — **không** ghi dữ liệu; loại sân bận qua `collectBusyCourtIds`
- Confirm: `confirmAssignments()` — ghi assignments + cập nhật queue/check-in + sync `courtStates`
- Deterministic: cùng input → cùng output (không random)
- Tái sử dụng scoring concepts từ AI Core; mở rộng Sprint 7

## RBAC

- Route `/court-engine`: `DIRECTOR_USE` OR `SCHEDULING_RUN`
- Chuyển sân: `canTransferCourt()` (chuẩn bị `court_engine.transfer`)
- RBAC tắt → workflow cũ

## Tích hợp hiện có

| Module | Dùng lại |
|--------|----------|
| `courtEngine.js` | `transferMatchToCourt` cho tournament matches |
| `refereeSessionService` | Route `/referee/:token` giữ nguyên |
| `loadPlayersForClub`, `loadCourtsForClub` | Nguồn VĐV/sân |
| `loadStaffForVenue` | Roster trọng tài |

## Test

```bash
npm test -- tests/court-engine.test.js
npm test -- tests/ui/court-engine.ui.test.jsx
```

Case P0: `occupied court skipped on second auto-assign` — confirm sân 1 → queue thêm 4 người → auto-assign lần 2 không gán lại sân bận.

## Giới hạn Sprint 6

- QR check-in: hook sẵn, chưa UI
- Drag-drop queue: reorder API có, UI chưa kéo thả
- Supabase sync: localStorage only
- Chưa nối trực tiếp Director Mode tournament matches

## Sprint 7 (AI Engine)

- Nối `runAI` / `pairing.js` vào `generateCourtAssignments`
- Giải thích chi tiết qua `buildCourtExplanation`
- Seed cho random social mode

## Production QA

| Hạng mục | Trạng thái | Ngày |
|----------|------------|------|
| Check-in | ✅ PASS | 2026-07-01 |
| Live Courts | ✅ PASS | 2026-07-01 |
| Court Assignment | ✅ PASS (P0 fix) | 2026-07-01 |
| Session Persistence | ✅ PASS | 2026-07-01 |
| Mobile responsive | ⚠️ PARTIAL | — |

| Ngày | Kết quả |
|------|---------|
| 2026-07-01 | ✅ PASS — check-in, gán sân, timer, reload persistence. Bug white screen reload `/court-engine`: **RESOLVED**. |
| 2026-07-01 | ✅ P0 fix — auto-assign không ghi đè sân bận; Court Engine Production QA **đóng**. |

Checklist: `docs/GA-PRODUCTION-QA.md` mục **F**.
