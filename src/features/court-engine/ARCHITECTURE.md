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
  engines/       autoCourtAssignmentEngine (generateCourtAssignments)
  services/      checkIn, queue, timer, transfer, referee, eventLog, courtEngineService
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
- `courtStates{}` — runtime sân (locked, maintenance)
- `config` — play mode, timer, repeat rules

Active session: `pickleball-court-engine-active-v1::{clubId}`

## Auto assignment

- Preview: `generateCourtAssignments()` — **không** ghi dữ liệu
- Confirm: `confirmAssignments()` — ghi assignments + cập nhật queue/check-in
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
node --test tests/court-engine.test.js
```

## Giới hạn Sprint 6

- QR check-in: hook sẵn, chưa UI
- Drag-drop queue: reorder API có, UI chưa kéo thả
- Supabase sync: localStorage only
- Chưa nối trực tiếp Director Mode tournament matches

## Sprint 7 (AI Engine)

- Nối `runAI` / `pairing.js` vào `generateCourtAssignments`
- Giải thích chi tiết qua `buildCourtExplanation`
- Seed cho random social mode
